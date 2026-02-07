import { create } from 'zustand';
import type { SyncStatus, ActivePR } from '@/types';

/** Read the branch from the URL search params on initial load */
function getInitialBranch(): string {
  if (typeof window === 'undefined') return 'main';
  return new URLSearchParams(window.location.search).get('branch') || 'main';
}

interface SyncStoreState {
  currentBranch: string;
  baseBranch: string;
  autoBranchName: string | null;
  branches: string[];
  lastSyncedSha: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  isSyncing: boolean;
  activePR: ActivePR | null;

  setCurrentBranch: (branch: string) => void;
  setBaseBranch: (branch: string) => void;
  setAutoBranchName: (name: string | null) => void;
  setBranches: (branches: string[]) => void;
  setLastSyncedSha: (sha: string | null) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncError: (error: string | null) => void;
  setIsSyncing: (syncing: boolean) => void;
  startSync: () => void;
  finishSync: (sha: string) => void;
  failSync: (error: string) => void;
  setActivePR: (pr: ActivePR | null) => void;
  clearActivePR: () => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  currentBranch: getInitialBranch(),
  baseBranch: 'main',
  autoBranchName: null,
  branches: [],
  lastSyncedSha: null,
  syncStatus: 'synced',
  syncError: null,
  isSyncing: false,
  activePR: null,

  setCurrentBranch: (branch) => set({ currentBranch: branch }),
  setBaseBranch: (branch) => set({ baseBranch: branch }),
  setAutoBranchName: (name) => set({ autoBranchName: name }),
  setBranches: (branches) => set({ branches }),
  setLastSyncedSha: (sha) => set({ lastSyncedSha: sha }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setSyncError: (error) => set({ syncError: error }),
  setIsSyncing: (syncing) => set({ isSyncing: syncing }),
  startSync: () => set({ isSyncing: true, syncError: null, syncStatus: 'syncing' }),
  finishSync: (sha) => set({
    isSyncing: false,
    syncStatus: 'synced',
    lastSyncedSha: sha,
    syncError: null
  }),
  failSync: (error) => set({
    isSyncing: false,
    syncStatus: 'error',
    syncError: error
  }),
  setActivePR: (pr) => set({ activePR: pr }),
  clearActivePR: () => set({ activePR: null }),
}));
