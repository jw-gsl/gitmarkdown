import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProvider } from '@/types';

export type SaveStrategy = 'main' | 'branch';
export type CommitValidationLevel = 'none' | 'warning' | 'error';

export interface AIPersona {
  id: string;
  name: string;
  description: string;
  instructions: string;
  avatar: string; // emoji
  isDefault?: boolean;
}

export const DEFAULT_PERSONAS: AIPersona[] = [
  {
    id: 'default',
    name: 'GitMarkdown',
    description: 'Balanced and helpful.',
    instructions: '',
    avatar: '✦',
    isDefault: true,
  },
  {
    id: 'editor',
    name: 'Editor',
    description: 'Precise, clear, and concise.',
    instructions: 'Focus on clarity, grammar, and conciseness. Be direct. Prefer shorter sentences. Remove filler words.',
    avatar: '✏️',
    isDefault: true,
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Imaginative and expressive.',
    instructions: 'Be creative and expressive. Use vivid language, metaphors, and varied sentence structures. Encourage bold ideas.',
    avatar: '🎨',
    isDefault: true,
  },
  {
    id: 'technical',
    name: 'Technical',
    description: 'Detailed and structured.',
    instructions: 'Focus on technical accuracy and structure. Use precise terminology. Include code examples when relevant. Be thorough.',
    avatar: '⚙️',
    isDefault: true,
  },
];

interface SettingsStoreState {
  theme: 'light' | 'dark' | 'system';
  aiProvider: AIProvider;
  aiModel: string;
  editorFontSize: number;
  editorLineHeight: number;
  showLineNumbers: boolean;
  autoCommitDelay: number;
  saveStrategy: SaveStrategy;
  autoBranchPrefix: string;
  excludeBranches: string[];
  commitOnClose: boolean;
  aiCommitMessages: boolean;
  pullOnOpen: boolean;
  filePattern: string;
  autoCreatePR: boolean;
  autoCreatePRTitle: string;
  commitValidationLevel: CommitValidationLevel;
  activePersonaId: string;

  setTheme: (theme: SettingsStoreState['theme']) => void;
  setAIProvider: (provider: AIProvider) => void;
  setAIModel: (model: string) => void;
  setEditorFontSize: (size: number) => void;
  setEditorLineHeight: (height: number) => void;
  setShowLineNumbers: (show: boolean) => void;
  setAutoCommitDelay: (delay: number) => void;
  setSaveStrategy: (strategy: SaveStrategy) => void;
  setAutoBranchPrefix: (prefix: string) => void;
  setExcludeBranches: (branches: string[]) => void;
  setCommitOnClose: (enabled: boolean) => void;
  setAiCommitMessages: (enabled: boolean) => void;
  setPullOnOpen: (enabled: boolean) => void;
  setFilePattern: (pattern: string) => void;
  setAutoCreatePR: (enabled: boolean) => void;
  setAutoCreatePRTitle: (title: string) => void;
  setCommitValidationLevel: (level: CommitValidationLevel) => void;
  setActivePersonaId: (id: string) => void;
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
      autoCommitDelay: 30,
      saveStrategy: 'main',
      autoBranchPrefix: 'gitmarkdown-auto/',
      excludeBranches: [],
      commitOnClose: true,
      aiCommitMessages: false,
      pullOnOpen: true,
      filePattern: '**/*',
      autoCreatePR: false,
      autoCreatePRTitle: 'Auto-save changes from GitMarkdown',
      commitValidationLevel: 'none',
      activePersonaId: 'default',

      setTheme: (theme) => set({ theme }),
      setAIProvider: (provider) => set({ aiProvider: provider }),
      setAIModel: (model) => set({ aiModel: model }),
      setEditorFontSize: (size) => set({ editorFontSize: size }),
      setEditorLineHeight: (height) => set({ editorLineHeight: height }),
      setShowLineNumbers: (show) => set({ showLineNumbers: show }),
      setAutoCommitDelay: (delay) => set({ autoCommitDelay: delay }),
      setSaveStrategy: (strategy) => set({ saveStrategy: strategy }),
      setAutoBranchPrefix: (prefix) => set({ autoBranchPrefix: prefix }),
      setExcludeBranches: (branches) => set({ excludeBranches: branches }),
      setCommitOnClose: (enabled) => set({ commitOnClose: enabled }),
      setAiCommitMessages: (enabled) => set({ aiCommitMessages: enabled }),
      setPullOnOpen: (enabled) => set({ pullOnOpen: enabled }),
      setFilePattern: (pattern) => set({ filePattern: pattern }),
      setAutoCreatePR: (enabled) => set({ autoCreatePR: enabled }),
      setAutoCreatePRTitle: (title) => set({ autoCreatePRTitle: title }),
      setCommitValidationLevel: (level) => set({ commitValidationLevel: level }),
      setActivePersonaId: (id) => set({ activePersonaId: id }),
    }),
    { name: 'gitmarkdown-settings' }
  )
);
