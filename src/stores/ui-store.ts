import { create } from 'zustand';

interface UIStoreState {
  sidebarOpen: boolean;
  aiSidebarOpen: boolean;
  commentSidebarOpen: boolean;
  versionHistoryOpen: boolean;
  tocOpen: boolean;
  activePanel: 'files' | 'ai' | 'comments' | 'versions' | 'toc' | null;
  commandPaletteOpen: boolean;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAISidebarOpen: (open: boolean) => void;
  toggleAISidebar: () => void;
  setCommentSidebarOpen: (open: boolean) => void;
  toggleCommentSidebar: () => void;
  setVersionHistoryOpen: (open: boolean) => void;
  setTocOpen: (open: boolean) => void;
  setActivePanel: (panel: UIStoreState['activePanel']) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  sidebarOpen: true,
  aiSidebarOpen: false,
  commentSidebarOpen: false,
  versionHistoryOpen: false,
  tocOpen: false,
  activePanel: 'files',
  commandPaletteOpen: false,

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
  setVersionHistoryOpen: (open) => set({ versionHistoryOpen: open }),
  setTocOpen: (open) => set({ tocOpen: open }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}));
