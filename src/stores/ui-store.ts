import { create } from 'zustand';

export interface InlineEditSelection {
  text: string;
  from: number;
  to: number;
}

interface UIStoreState {
  sidebarOpen: boolean;
  aiSidebarOpen: boolean;
  commentSidebarOpen: boolean;
  versionHistoryOpen: boolean;
  tocOpen: boolean;
  activePanel: 'files' | 'ai' | 'comments' | 'versions' | 'toc' | null;
  commandPaletteOpen: boolean;
  diffViewCommitSha: string | null;
  activeCommentCount: number;
  inlineEditSelection: InlineEditSelection | null;
  aiChatContext: string | null;
  pendingTextEdit: { oldText: string; newText: string } | null;
  sidebarWidth: number;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAISidebarOpen: (open: boolean) => void;
  toggleAISidebar: () => void;
  setCommentSidebarOpen: (open: boolean) => void;
  toggleCommentSidebar: () => void;
  setVersionHistoryOpen: (open: boolean) => void;
  toggleVersionHistory: () => void;
  setTocOpen: (open: boolean) => void;
  setActivePanel: (panel: UIStoreState['activePanel']) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDiffViewCommitSha: (sha: string | null) => void;
  setActiveCommentCount: (count: number) => void;
  setInlineEditSelection: (sel: InlineEditSelection | null) => void;
  setAIChatContext: (context: string | null) => void;
  setPendingTextEdit: (edit: { oldText: string; newText: string } | null) => void;
  setSidebarWidth: (width: number) => void;
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  sidebarOpen: true,
  aiSidebarOpen: false,
  commentSidebarOpen: false,
  versionHistoryOpen: false,
  tocOpen: false,
  activePanel: 'files',
  commandPaletteOpen: false,
  diffViewCommitSha: null,
  activeCommentCount: 0,
  inlineEditSelection: null,
  aiChatContext: null,
  pendingTextEdit: null,
  sidebarWidth: 256,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setAISidebarOpen: (open) => set({ aiSidebarOpen: open, activePanel: open ? 'ai' : get().activePanel }),
  toggleAISidebar: () => {
    const isOpen = !get().aiSidebarOpen;
    set({ aiSidebarOpen: isOpen, activePanel: isOpen ? 'ai' : 'files' });
  },
  setCommentSidebarOpen: (open) => set({ commentSidebarOpen: open, activePanel: open ? 'comments' : get().activePanel }),
  toggleCommentSidebar: () => {
    const isOpen = !get().commentSidebarOpen;
    set({ commentSidebarOpen: isOpen, activePanel: isOpen ? 'comments' : 'files' });
  },
  setVersionHistoryOpen: (open) => set({ versionHistoryOpen: open, activePanel: open ? 'versions' : get().activePanel }),
  toggleVersionHistory: () => {
    const isOpen = !get().versionHistoryOpen;
    set({ versionHistoryOpen: isOpen, activePanel: isOpen ? 'versions' : 'files' });
  },
  setTocOpen: (open) => set({ tocOpen: open }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setDiffViewCommitSha: (sha) => set({ diffViewCommitSha: sha }),
  setActiveCommentCount: (count) => set({ activeCommentCount: count }),
  setInlineEditSelection: (sel) => set({ inlineEditSelection: sel }),
  setAIChatContext: (context) => set({ aiChatContext: context }),
  setPendingTextEdit: (edit) => set({ pendingTextEdit: edit }),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.min(480, Math.max(200, width)) }),
}));
