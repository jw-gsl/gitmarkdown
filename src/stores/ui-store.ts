import { create } from 'zustand';

export interface InlineEditSelection {
  text: string;
  from: number;
  to: number;
}

type DiffViewMode = 'split' | 'unified';

/** Snapshot of editor content taken before an AI edit is applied */
export interface AIEditSnapshot {
  content: string;
  filePath: string;
  timestamp: number;
}

/** Pending AI diff shown in the editor area for review before applying */
export interface PendingAIDiff {
  oldText: string;
  newText: string;
  isFullRewrite: boolean;
}

export type RightPanelTab = 'ai' | 'comments' | 'versions' | 'checks';

interface UIStoreState {
  sidebarOpen: boolean;
  /** Unified right panel state */
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab | null;
  tocOpen: boolean;
  activePanel: 'files' | 'ai' | 'comments' | 'versions' | 'toc' | 'checks' | null;
  commandPaletteOpen: boolean;
  diffViewCommitSha: string | null;
  diffViewMode: DiffViewMode;
  activeCommentCount: number;
  inlineEditSelection: InlineEditSelection | null;
  aiChatContext: string | null;
  pendingTextEdit: { oldText: string; newText: string } | null;
  activeCheck: { text: string; suggestion: string; index: number } | null;
  checkActionResult: { index: number; action: 'keep' | 'dismiss' } | null;
  /** AI diff pending review in the editor area */
  pendingAIDiff: PendingAIDiff | null;
  /** Resolution signal from editor back to sidebar: true = applied, false = dismissed */
  pendingAIDiffResolved: boolean | null;
  sidebarWidth: number;
  /** Stack of pre-AI-edit snapshots for one-click rollback */
  aiEditSnapshots: AIEditSnapshot[];
  focusMode: boolean;
  settingsDialogOpen: boolean;
  settingsDialogTab: string | null;
  tabPanelStates: Record<string, RightPanelTab | null>;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  /** Open the right panel to a specific tab */
  openRightPanel: (tab: RightPanelTab) => void;
  /** Close the right panel */
  closeRightPanel: () => void;
  /** Toggle a specific tab — if already active, close; otherwise switch */
  toggleRightPanelTab: (tab: RightPanelTab) => void;
  /** Backward-compatible aliases */
  setAISidebarOpen: (open: boolean) => void;
  toggleAISidebar: () => void;
  setCommentSidebarOpen: (open: boolean) => void;
  toggleCommentSidebar: () => void;
  setVersionHistoryOpen: (open: boolean) => void;
  toggleVersionHistory: () => void;
  setChecksOpen: (open: boolean) => void;
  toggleChecks: () => void;
  setTocOpen: (open: boolean) => void;
  setActivePanel: (panel: UIStoreState['activePanel']) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDiffViewCommitSha: (sha: string | null) => void;
  setDiffViewMode: (mode: DiffViewMode) => void;
  setActiveCommentCount: (count: number) => void;
  setInlineEditSelection: (sel: InlineEditSelection | null) => void;
  setAIChatContext: (context: string | null) => void;
  setPendingTextEdit: (edit: { oldText: string; newText: string } | null) => void;
  setActiveCheck: (check: { text: string; suggestion: string; index: number } | null) => void;
  setCheckActionResult: (result: { index: number; action: 'keep' | 'dismiss' } | null) => void;
  setPendingAIDiff: (diff: PendingAIDiff | null) => void;
  resolvePendingAIDiff: (accepted: boolean) => void;
  clearPendingAIDiffResolved: () => void;
  setSidebarWidth: (width: number) => void;
  pushAIEditSnapshot: (snapshot: AIEditSnapshot) => void;
  popAIEditSnapshot: () => AIEditSnapshot | undefined;
  clearAIEditSnapshots: () => void;
  setFocusMode: (enabled: boolean) => void;
  toggleFocusMode: () => void;
  openSettingsDialog: (tab?: string) => void;
  closeSettingsDialog: () => void;
  switchTab: (fromPath: string | null, toPath: string) => void;
  clearTabPanelState: (path: string) => void;
  /** Derived backward-compatible getters */
  readonly aiSidebarOpen: boolean;
  readonly commentSidebarOpen: boolean;
  readonly versionHistoryOpen: boolean;
  readonly checksOpen: boolean;
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  sidebarOpen: true,
  rightPanelOpen: false,
  rightPanelTab: null,
  tocOpen: false,
  activePanel: 'files',
  commandPaletteOpen: false,
  diffViewCommitSha: null,
  diffViewMode: 'unified',
  activeCommentCount: 0,
  inlineEditSelection: null,
  aiChatContext: null,
  pendingTextEdit: null,
  activeCheck: null,
  checkActionResult: null,
  pendingAIDiff: null,
  pendingAIDiffResolved: null,
  sidebarWidth: 256,
  aiEditSnapshots: [],
  focusMode: false,
  settingsDialogOpen: false,
  settingsDialogTab: null,
  tabPanelStates: {},

  // Derived backward-compatible getters
  get aiSidebarOpen() { return get().rightPanelOpen && get().rightPanelTab === 'ai'; },
  get commentSidebarOpen() { return get().rightPanelOpen && get().rightPanelTab === 'comments'; },
  get versionHistoryOpen() { return get().rightPanelOpen && get().rightPanelTab === 'versions'; },
  get checksOpen() { return get().rightPanelOpen && get().rightPanelTab === 'checks'; },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),

  // ── Unified right panel methods ──
  openRightPanel: (tab) => set({ rightPanelOpen: true, rightPanelTab: tab, activePanel: tab === 'versions' ? 'versions' : tab }),
  closeRightPanel: () => set({ rightPanelOpen: false, activePanel: 'files' }),
  toggleRightPanelTab: (tab) => {
    const state = get();
    if (state.rightPanelOpen && state.rightPanelTab === tab) {
      set({ rightPanelOpen: false, activePanel: 'files' });
    } else {
      set({ rightPanelOpen: true, rightPanelTab: tab, activePanel: tab === 'versions' ? 'versions' : tab });
    }
  },

  // ── Backward-compatible aliases (redirect to unified panel) ──
  setAISidebarOpen: (open) => {
    if (open) set({ rightPanelOpen: true, rightPanelTab: 'ai', activePanel: 'ai' });
    else if (get().rightPanelTab === 'ai') set({ rightPanelOpen: false, activePanel: 'files' });
  },
  toggleAISidebar: () => get().toggleRightPanelTab('ai'),
  setCommentSidebarOpen: (open) => {
    if (open) set({ rightPanelOpen: true, rightPanelTab: 'comments', activePanel: 'comments' });
    else if (get().rightPanelTab === 'comments') set({ rightPanelOpen: false, activePanel: 'files' });
  },
  toggleCommentSidebar: () => get().toggleRightPanelTab('comments'),
  setVersionHistoryOpen: (open) => {
    if (open) set({ rightPanelOpen: true, rightPanelTab: 'versions', activePanel: 'versions' });
    else if (get().rightPanelTab === 'versions') set({ rightPanelOpen: false, activePanel: 'files' });
  },
  toggleVersionHistory: () => get().toggleRightPanelTab('versions'),
  setChecksOpen: (open) => {
    if (open) set({ rightPanelOpen: true, rightPanelTab: 'checks', activePanel: 'checks' });
    else if (get().rightPanelTab === 'checks') set({ rightPanelOpen: false, activePanel: 'files' });
  },
  toggleChecks: () => get().toggleRightPanelTab('checks'),

  setTocOpen: (open) => set({ tocOpen: open }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setDiffViewCommitSha: (sha) => set({ diffViewCommitSha: sha }),
  setDiffViewMode: (mode) => set({ diffViewMode: mode }),
  setActiveCommentCount: (count) => set({ activeCommentCount: count }),
  setInlineEditSelection: (sel) => set({ inlineEditSelection: sel }),
  setAIChatContext: (context) => set({ aiChatContext: context }),
  setPendingTextEdit: (edit) => set({ pendingTextEdit: edit }),
  setActiveCheck: (check) => set({ activeCheck: check }),
  setCheckActionResult: (result) => set({ checkActionResult: result }),
  setPendingAIDiff: (diff) => set({ pendingAIDiff: diff, pendingAIDiffResolved: null }),
  resolvePendingAIDiff: (accepted) => set({ pendingAIDiff: null, pendingAIDiffResolved: accepted }),
  clearPendingAIDiffResolved: () => set({ pendingAIDiffResolved: null }),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.min(480, Math.max(200, width)) }),
  pushAIEditSnapshot: (snapshot) => set((s) => ({ aiEditSnapshots: [...s.aiEditSnapshots, snapshot] })),
  popAIEditSnapshot: () => {
    const snapshots = get().aiEditSnapshots;
    if (snapshots.length === 0) return undefined;
    const last = snapshots[snapshots.length - 1];
    set({ aiEditSnapshots: snapshots.slice(0, -1) });
    return last;
  },
  clearAIEditSnapshots: () => set({ aiEditSnapshots: [] }),
  setFocusMode: (enabled) => set({ focusMode: enabled }),
  toggleFocusMode: () => set({ focusMode: !get().focusMode }),
  openSettingsDialog: (tab) => set({ settingsDialogOpen: true, settingsDialogTab: tab ?? null }),
  closeSettingsDialog: () => set({ settingsDialogOpen: false, settingsDialogTab: null }),

  switchTab: (fromPath, toPath) => {
    const state = get();
    // Determine current right-panel tab (excluding AI, which persists across file switches)
    const currentPanel: RightPanelTab | null =
      (state.rightPanelOpen && state.rightPanelTab && state.rightPanelTab !== 'ai')
        ? state.rightPanelTab
        : null;

    // Save current tab's panel state
    const newTabPanelStates = { ...state.tabPanelStates };
    if (fromPath) {
      newTabPanelStates[fromPath] = currentPanel;
    }

    // Restore target tab's saved panel (default: null = no panel)
    const restoredPanel = newTabPanelStates[toPath] ?? null;

    // Determine new right panel state
    const isAIOpen = state.rightPanelOpen && state.rightPanelTab === 'ai';
    const newTab = restoredPanel ?? (isAIOpen ? 'ai' : null);
    const newOpen = newTab !== null ? true : isAIOpen;

    // Determine activePanel
    const activePanel: UIStoreState['activePanel'] =
      newTab ?? (isAIOpen ? 'ai' : 'files');

    set({
      tabPanelStates: newTabPanelStates,
      rightPanelOpen: newOpen,
      rightPanelTab: newTab ?? (isAIOpen ? 'ai' : null),
      activePanel,
      // Clear file-specific transient state
      activeCheck: null,
      checkActionResult: null,
      diffViewCommitSha: null,
      inlineEditSelection: null,
    });
  },

  clearTabPanelState: (path) => {
    const { tabPanelStates } = get();
    if (path in tabPanelStates) {
      const next = { ...tabPanelStates };
      delete next[path];
      set({ tabPanelStates: next });
    }
  },
}));
