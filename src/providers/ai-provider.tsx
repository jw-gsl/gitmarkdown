'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import type { AIProvider as AIProviderType } from '@/types';

interface AIContextType {
  provider: AIProviderType;
  model: string;
}

const AIContext = createContext<AIContextType>({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
});

export function AIProvider({ children }: { children: ReactNode }) {
  const { aiProvider, aiModel } = useSettingsStore();

  return (
    <AIContext.Provider value={{ provider: aiProvider, model: aiModel }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  return useContext(AIContext);
}
