import { create } from 'zustand';
import type { SyncStatus } from '@/types';

interface SyncStoreState {
  currentBranch: string;
  branches: string[];
  lastSyncedSha: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  isSyncing: boolean;

  setCurrentBranch: (branch: string) => void;
  setBranches: (branches: string[]) => void;
  setLastSyncedSha: (sha: string | null) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncError: (error: string | null) => void;
  setIsSyncing: (syncing: boolean) => void;
  startSync: () => void;
  finishSync: (sha: string) => void;
  failSync: (error: string) => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  currentBranch: 'main',
  branches: [],
  lastSyncedSha: null,
  syncStatus: 'synced',
  syncError: null,
  isSyncing: false,

  setCurrentBranch: (branch) => set({ currentBranch: branch }),
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
}));
