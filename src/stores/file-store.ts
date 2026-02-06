import { create } from 'zustand';
import type { FileNode, SyncStatus } from '@/types';

interface FileStoreState {
  files: FileNode[];
  currentFile: FileNode | null;
  expandedDirs: Set<string>;
  showAllFiles: boolean;
  searchQuery: string;
  syncStatus: SyncStatus;
  dirtyFiles: Set<string>;

  setFiles: (files: FileNode[]) => void;
  setCurrentFile: (file: FileNode | null) => void;
  toggleDir: (path: string) => void;
  setShowAllFiles: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSyncStatus: (status: SyncStatus) => void;
  markDirty: (filePath: string) => void;
  markClean: (filePath: string) => void;
  clearDirty: () => void;
  updateFileContent: (filePath: string, content: string) => void;
}

export const useFileStore = create<FileStoreState>((set, get) => ({
  files: [],
  currentFile: null,
  expandedDirs: new Set<string>(),
  showAllFiles: false,
  searchQuery: '',
  syncStatus: 'synced',
  dirtyFiles: new Set<string>(),

  setFiles: (files) => set({ files }),
  setCurrentFile: (file) => set({ currentFile: file }),
  toggleDir: (path) => {
    const expanded = new Set(get().expandedDirs);
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    set({ expandedDirs: expanded });
  },
  setShowAllFiles: (show) => set({ showAllFiles: show }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  markDirty: (filePath) => {
    const dirty = new Set(get().dirtyFiles);
    dirty.add(filePath);
    set({ dirtyFiles: dirty, syncStatus: 'local-changes' });
  },
  markClean: (filePath) => {
    const dirty = new Set(get().dirtyFiles);
    dirty.delete(filePath);
    set({
      dirtyFiles: dirty,
      syncStatus: dirty.size === 0 ? 'synced' : 'local-changes'
    });
  },
  clearDirty: () => set({ dirtyFiles: new Set(), syncStatus: 'synced' }),
  updateFileContent: (filePath, content) => {
    const files = get().files.map(f =>
      f.path === filePath ? { ...f, content } : f
    );
    const currentFile = get().currentFile;
    set({
      files,
      currentFile: currentFile?.path === filePath
        ? { ...currentFile, content }
        : currentFile,
    });
  },
}));
