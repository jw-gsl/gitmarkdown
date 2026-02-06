import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProvider } from '@/types';

interface SettingsStoreState {
  theme: 'light' | 'dark' | 'system';
  aiProvider: AIProvider;
  aiModel: string;
  editorFontSize: number;
  editorLineHeight: number;
  showLineNumbers: boolean;

  setTheme: (theme: SettingsStoreState['theme']) => void;
  setAIProvider: (provider: AIProvider) => void;
  setAIModel: (model: string) => void;
  setEditorFontSize: (size: number) => void;
  setEditorLineHeight: (height: number) => void;
  setShowLineNumbers: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      theme: 'system',
      aiProvider: (process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER as AIProvider) || 'anthropic',
      aiModel: process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL || 'claude-sonnet-4-20250514',
      editorFontSize: 16,
      editorLineHeight: 1.6,
      showLineNumbers: false,

      setTheme: (theme) => set({ theme }),
      setAIProvider: (provider) => set({ aiProvider: provider }),
      setAIModel: (model) => set({ aiModel: model }),
      setEditorFontSize: (size) => set({ editorFontSize: size }),
      setEditorLineHeight: (height) => set({ editorLineHeight: height }),
      setShowLineNumbers: (show) => set({ showLineNumbers: show }),
    }),
    { name: 'gitmarkdown-settings' }
  )
);
