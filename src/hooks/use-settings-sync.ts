'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useSettingsStore } from '@/stores/settings-store';
import { getUserSettings, saveUserSettings } from '@/lib/firebase/firestore';

/** Settings keys to sync (everything except setter functions). */
const SETTINGS_KEYS = [
  'theme',
  'aiProvider',
  'aiModel',
  'editorFontSize',
  'editorLineHeight',
  'showLineNumbers',
  'autoCommitDelay',
  'saveStrategy',
  'autoBranchPrefix',
  'excludeBranches',
  'commitOnClose',
  'aiCommitMessages',
  'pullOnOpen',
  'filePattern',
  'autoCreatePR',
  'autoCreatePRTitle',
  'commitValidationLevel',
] as const;

function extractSettings(state: Record<string, unknown>): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const key of SETTINGS_KEYS) {
    settings[key] = state[key];
  }
  return settings;
}

/**
 * Syncs the zustand settings store with Firestore.
 * - On login: loads settings from Firestore and merges into the store.
 * - On change: debounce-saves settings to Firestore (1.5s after last change).
 * - localStorage remains the fast local cache; Firestore is the cross-device source of truth.
 */
export function useSettingsSync() {
  const { user } = useAuth();
  const syncedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);

  // Load settings from Firestore on login
  useEffect(() => {
    if (!user?.uid) {
      syncedRef.current = false;
      return;
    }
    if (syncedRef.current) return;

    getUserSettings(user.uid)
      .then((data) => {
        if (data) {
          // Merge Firestore values into the store (skip the save triggered by setState)
          skipNextSave.current = true;
          const updates: Record<string, unknown> = {};
          for (const key of SETTINGS_KEYS) {
            if (key in data && data[key] !== undefined) {
              updates[key] = data[key];
            }
          }
          useSettingsStore.setState(updates);
        }
        syncedRef.current = true;
      })
      .catch(() => {
        // Firestore unavailable — just use local values
        syncedRef.current = true;
      });
  }, [user?.uid]);

  // Subscribe to store changes and save to Firestore (debounced)
  useEffect(() => {
    if (!user?.uid) return;

    const uid = user.uid;

    const unsubscribe = useSettingsStore.subscribe(() => {
      if (skipNextSave.current) {
        skipNextSave.current = false;
        return;
      }
      if (!syncedRef.current) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const settings = extractSettings(
          useSettingsStore.getState() as unknown as Record<string, unknown>
        );
        saveUserSettings(uid, settings).catch(() => {
          // Silently fail — localStorage is the fallback
        });
      }, 1500);
    });

    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [user?.uid]);
}
