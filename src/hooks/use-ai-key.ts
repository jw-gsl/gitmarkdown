'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings-store';
import type { AIProvider } from '@/types';

/**
 * Returns the user's API key for the active provider (if set),
 * and a guard function that shows a toast + opens settings when no key is available.
 */
export function useAIKey() {
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const userAnthropicKey = useSettingsStore((s) => s.userAnthropicKey);
  const userOpenAIKey = useSettingsStore((s) => s.userOpenAIKey);

  const getUserApiKey = useCallback(
    (provider?: AIProvider) => {
      const p = provider || aiProvider;
      if (p === 'anthropic') return userAnthropicKey || undefined;
      if (p === 'openai') return userOpenAIKey || undefined;
      return undefined;
    },
    [aiProvider, userAnthropicKey, userOpenAIKey]
  );

  return { getUserApiKey, aiProvider };
}

/**
 * Handle a NO_API_KEY error from AI API routes.
 * Returns true if the error was handled (caller should abort), false otherwise.
 */
export function handleAIKeyError(error: unknown, openSettings?: (tab: string) => void): boolean {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : (error as any)?.error || (error as any)?.message || '';
  if (msg === 'NO_API_KEY' || (typeof msg === 'string' && msg.includes('No') && msg.includes('API key'))) {
    toast.error('API key required', {
      description: 'Add your API key in Settings → AI to use this feature.',
      action: openSettings
        ? { label: 'Open Settings', onClick: () => openSettings('ai') }
        : undefined,
    });
    return true;
  }
  return false;
}
