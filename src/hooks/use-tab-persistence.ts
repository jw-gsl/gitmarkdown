'use client';

import { useEffect, useRef } from 'react';
import { useFileStore } from '@/stores/file-store';
import type { TabItem } from '@/stores/file-store';

export function useTabPersistence(owner: string, repo: string) {
  const storageKey = `gitmarkdown-tabs:${owner}/${repo}`;
  const initialized = useRef(false);

  // Read from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored) as { tabs: TabItem[]; active: string | null };
        if (data.tabs?.length > 0) {
          useFileStore.getState().setOpenTabs(data.tabs);
          if (data.active) {
            useFileStore.getState().setActiveTab(data.active);
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
    initialized.current = true;
  }, [storageKey]);

  // Debounced write to localStorage on changes
  useEffect(() => {
    if (!initialized.current) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useFileStore.subscribe((state, prevState) => {
      if (state.openTabs !== prevState.openTabs || state.activeTabPath !== prevState.activeTabPath) {
        // Clear any pending debounce before scheduling a new one
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          try {
            const data = { tabs: state.openTabs, active: state.activeTabPath };
            localStorage.setItem(storageKey, JSON.stringify(data));
          } catch {
            // Ignore storage errors
          }
        }, 300);
      }
    });

    return () => {
      unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
  }, [storageKey]);
}
