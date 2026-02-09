import { create } from 'zustand';
import type { FileNode, SyncStatus, PendingFileOp } from '@/types';
import { isMarkdownFile } from '@/lib/editor/markdown-serializer';

export interface TabItem {
  path: string;
  name: string;
  pinned?: boolean;
}

const MAX_TABS = 20;

interface FileStoreState {
  files: FileNode[];
  currentFile: FileNode | null;
  expandedDirs: Set<string>;
  showAllFiles: boolean;
  searchQuery: string;
  syncStatus: SyncStatus;
  dirtyFiles: Set<string>;
  originalContents: Map<string, string>;
  pendingOps: PendingFileOp[];
  openTabs: TabItem[];
  activeTabPath: string | null;

  setFiles: (files: FileNode[]) => void;
  setCurrentFile: (file: FileNode | null) => void;
  toggleDir: (path: string) => void;
  expandAllDirs: () => void;
  collapseAllDirs: () => void;
  setShowAllFiles: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSyncStatus: (status: SyncStatus) => void;
  markDirty: (filePath: string) => void;
  markClean: (filePath: string) => void;
  clearDirty: () => void;
  setOriginalContent: (path: string, content: string) => void;
  clearOriginalContent: (path: string) => void;
  updateFileContent: (filePath: string, content: string) => void;
  addPendingOp: (op: PendingFileOp) => void;
  removePendingOp: (index: number) => void;
  clearPendingOps: () => void;
  applyOpToTree: (op: PendingFileOp) => void;
  openTab: (tab: TabItem) => void;
  closeTab: (path: string) => void;
  closeOtherTabs: (path: string) => void;
  closeTabsToRight: (path: string) => void;
  closeAllTabs: () => void;
  closeSavedTabs: () => void;
  setActiveTab: (path: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  setOpenTabs: (tabs: TabItem[]) => void;
  pinTab: (path: string) => void;
  unpinTab: (path: string) => void;
}

/** Helper: insert a FileNode into a tree at the given path */
function insertNodeInTree(files: FileNode[], path: string, content: string): FileNode[] {
  const parts = path.split('/');
  const name = parts[parts.length - 1];

  // Top-level file
  if (parts.length === 1) {
    return [...files, {
      id: `pending-${path}`,
      path,
      name,
      type: 'file',
      isMarkdown: isMarkdownFile(name),
      content,
    }];
  }

  // Need to find/create parent directories
  const parentPath = parts.slice(0, -1).join('/');
  let found = false;

  const result = files.map((node) => {
    if (node.type === 'directory' && node.path === parentPath) {
      found = true;
      return {
        ...node,
        children: [...(node.children || []), {
          id: `pending-${path}`,
          path,
          name,
          type: 'file' as const,
          isMarkdown: isMarkdownFile(name),
          content,
        }],
      };
    }
    if (node.type === 'directory' && parentPath.startsWith(node.path + '/') && node.children) {
      return { ...node, children: insertNodeInTree(node.children, path, content) };
    }
    return node;
  });

  // If parent dir doesn't exist, create it
  if (!found && !result.some(n => n.type === 'directory' && parentPath.startsWith(n.path))) {
    const dirNode: FileNode = {
      id: `pending-dir-${parentPath}`,
      path: parentPath,
      name: parts[parts.length - 2],
      type: 'directory',
      isMarkdown: false,
      children: [{
        id: `pending-${path}`,
        path,
        name,
        type: 'file',
        isMarkdown: isMarkdownFile(name),
        content,
      }],
    };
    return [...result, dirNode];
  }

  return result;
}

/** Helper: remove a FileNode from the tree by path */
function removeNodeFromTree(files: FileNode[], path: string): FileNode[] {
  return files
    .filter((node) => node.path !== path)
    .map((node) => {
      if (node.type === 'directory' && node.children) {
        return { ...node, children: removeNodeFromTree(node.children, path) };
      }
      return node;
    });
}

/** Helper: rename/move a FileNode in the tree */
function renameNodeInTree(files: FileNode[], oldPath: string, newPath: string): FileNode[] {
  const newParts = newPath.split('/');
  const newName = newParts[newParts.length - 1];
  const oldDir = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : '';
  const newDir = newPath.includes('/') ? newPath.substring(0, newPath.lastIndexOf('/')) : '';

  // Same directory: simple rename
  if (oldDir === newDir) {
    return files.map((node) => {
      if (node.path === oldPath) {
        return { ...node, path: newPath, name: newName, id: `pending-${newPath}`, isMarkdown: isMarkdownFile(newName) };
      }
      if (node.type === 'directory' && node.children) {
        return { ...node, children: renameNodeInTree(node.children, oldPath, newPath) };
      }
      return node;
    });
  }

  // Different directory: remove from old, insert at new
  let content = '';
  const findContent = (nodes: FileNode[]): void => {
    for (const n of nodes) {
      if (n.path === oldPath) { content = n.content || ''; return; }
      if (n.children) findContent(n.children);
    }
  };
  findContent(files);

  const removed = removeNodeFromTree(files, oldPath);
  return insertNodeInTree(removed, newPath, content);
}

export const useFileStore = create<FileStoreState>((set, get) => ({
  files: [],
  currentFile: null,
  expandedDirs: new Set<string>(),
  showAllFiles: false,
  searchQuery: '',
  syncStatus: 'synced',
  dirtyFiles: new Set<string>(),
  originalContents: new Map<string, string>(),
  pendingOps: [],
  openTabs: [],
  activeTabPath: null,

  setFiles: (files) => set({ files }),
  setCurrentFile: (file) => {
    set({ currentFile: file });
    if (file) {
      // Auto-open a tab for this file
      const { openTabs, activeTabPath } = get();
      const exists = openTabs.some((t) => t.path === file.path);
      if (!exists) {
        let tabs = [...openTabs, { path: file.path, name: file.name }];
        // Enforce MAX_TABS by evicting oldest non-active, non-pinned tab
        if (tabs.length > MAX_TABS) {
          const evictIndex = tabs.findIndex((t) => t.path !== file.path && t.path !== activeTabPath && !t.pinned);
          if (evictIndex !== -1) tabs.splice(evictIndex, 1);
        }
        set({ openTabs: tabs, activeTabPath: file.path });
      } else if (activeTabPath !== file.path) {
        set({ activeTabPath: file.path });
      }
    }
  },
  toggleDir: (path) => {
    const expanded = new Set(get().expandedDirs);
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    set({ expandedDirs: expanded });
  },
  expandAllDirs: () => {
    const allDirs = new Set<string>();
    const collect = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          allDirs.add(node.path);
          if (node.children) collect(node.children);
        }
      }
    };
    collect(get().files);
    set({ expandedDirs: allDirs });
  },
  collapseAllDirs: () => set({ expandedDirs: new Set<string>() }),
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
    const hasPending = get().pendingOps.length > 0;
    set({
      dirtyFiles: dirty,
      syncStatus: dirty.size === 0 && !hasPending ? 'synced' : 'local-changes'
    });
  },
  clearDirty: () => {
    const hasPending = get().pendingOps.length > 0;
    set({ dirtyFiles: new Set(), originalContents: new Map(), syncStatus: hasPending ? 'local-changes' : 'synced' });
  },
  setOriginalContent: (path, content) => {
    const oc = new Map(get().originalContents);
    oc.set(path, content);
    set({ originalContents: oc });
  },
  clearOriginalContent: (path) => {
    const oc = new Map(get().originalContents);
    oc.delete(path);
    set({ originalContents: oc });
  },
  updateFileContent: (filePath, content) => {
    const updateInTree = (nodes: FileNode[]): FileNode[] =>
      nodes.map((f) => {
        if (f.path === filePath) return { ...f, content };
        if (f.type === 'directory' && f.children) {
          return { ...f, children: updateInTree(f.children) };
        }
        return f;
      });
    const files = updateInTree(get().files);
    const currentFile = get().currentFile;
    set({
      files,
      currentFile: currentFile?.path === filePath
        ? { ...currentFile, content }
        : currentFile,
    });
  },
  addPendingOp: (op) => {
    set({
      pendingOps: [...get().pendingOps, op],
      syncStatus: 'local-changes',
    });
  },
  removePendingOp: (index) => {
    const ops = [...get().pendingOps];
    ops.splice(index, 1);
    const hasDirty = get().dirtyFiles.size > 0;
    set({
      pendingOps: ops,
      syncStatus: ops.length === 0 && !hasDirty ? 'synced' : 'local-changes',
    });
  },
  clearPendingOps: () => {
    const hasDirty = get().dirtyFiles.size > 0;
    set({ pendingOps: [], syncStatus: hasDirty ? 'local-changes' : 'synced' });
  },
  applyOpToTree: (op) => {
    const files = get().files;
    const expanded = new Set(get().expandedDirs);
    let updatedFiles: FileNode[];

    switch (op.type) {
      case 'create':
      case 'duplicate':
        updatedFiles = insertNodeInTree(files, op.type === 'create' ? op.path : op.newPath, op.content);
        // Auto-expand parent directory
        {
          const path = op.type === 'create' ? op.path : op.newPath;
          const parentDir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
          if (parentDir) expanded.add(parentDir);
        }
        break;
      case 'delete':
        updatedFiles = removeNodeFromTree(files, op.path);
        break;
      case 'rename':
      case 'move':
        updatedFiles = renameNodeInTree(files, op.oldPath, op.newPath);
        // Auto-expand target directory for moves
        if (op.type === 'move') {
          const targetDir = op.newPath.includes('/') ? op.newPath.substring(0, op.newPath.lastIndexOf('/')) : '';
          if (targetDir) expanded.add(targetDir);
        }
        break;
      default:
        return;
    }

    set({ files: updatedFiles, expandedDirs: expanded });
  },
  openTab: (tab) => {
    const { openTabs, activeTabPath } = get();
    const exists = openTabs.some((t) => t.path === tab.path);
    if (!exists) {
      let tabs = [...openTabs, tab];
      if (tabs.length > MAX_TABS) {
        const evictIndex = tabs.findIndex((t) => t.path !== tab.path && t.path !== activeTabPath && !t.pinned);
        if (evictIndex !== -1) tabs.splice(evictIndex, 1);
      }
      set({ openTabs: tabs, activeTabPath: tab.path });
    } else {
      set({ activeTabPath: tab.path });
    }
  },
  closeTab: (path) => {
    const { openTabs, activeTabPath } = get();
    const tab = openTabs.find((t) => t.path === path);
    if (!tab || tab.pinned) return;
    const index = openTabs.findIndex((t) => t.path === path);
    const newTabs = openTabs.filter((t) => t.path !== path);
    let newActive = activeTabPath;
    if (activeTabPath === path) {
      if (newTabs.length === 0) {
        newActive = null;
      } else if (index < newTabs.length) {
        newActive = newTabs[index].path;
      } else {
        newActive = newTabs[newTabs.length - 1].path;
      }
    }
    set({ openTabs: newTabs, activeTabPath: newActive });
  },
  closeOtherTabs: (path) => {
    const { openTabs } = get();
    const kept = openTabs.filter((t) => t.path === path || t.pinned);
    set({ openTabs: kept, activeTabPath: kept.length > 0 ? path : null });
  },
  closeTabsToRight: (path) => {
    const { openTabs, activeTabPath } = get();
    const index = openTabs.findIndex((t) => t.path === path);
    if (index === -1) return;
    const kept = openTabs.filter((t, i) => i <= index || t.pinned);
    const newActive = kept.some((t) => t.path === activeTabPath) ? activeTabPath : path;
    set({ openTabs: kept, activeTabPath: newActive });
  },
  closeAllTabs: () => {
    const { openTabs } = get();
    const pinned = openTabs.filter((t) => t.pinned);
    set({ openTabs: pinned, activeTabPath: pinned.length > 0 ? pinned[0].path : null });
  },
  closeSavedTabs: () => {
    const { openTabs, activeTabPath, dirtyFiles } = get();
    const kept = openTabs.filter((t) => t.pinned || dirtyFiles.has(t.path));
    const newActive = kept.some((t) => t.path === activeTabPath)
      ? activeTabPath
      : kept.length > 0 ? kept[kept.length - 1].path : null;
    set({ openTabs: kept, activeTabPath: newActive });
  },
  setActiveTab: (path) => {
    set({ activeTabPath: path });
  },
  reorderTabs: (fromIndex, toIndex) => {
    const tabs = [...get().openTabs];
    const movedTab = tabs[fromIndex];
    if (!movedTab) return;
    // Enforce pinned/unpinned boundary: pinned tabs stay in the pinned section and vice versa
    const lastPinnedIndex = tabs.reduce((acc, t, i) => (t.pinned ? i : acc), -1);
    if (movedTab.pinned) {
      // Pinned tab can only move within [0, lastPinnedIndex]
      if (toIndex > lastPinnedIndex) return;
    } else {
      // Unpinned tab can only move within [lastPinnedIndex + 1, end]
      if (toIndex <= lastPinnedIndex) return;
    }
    const [moved] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, moved);
    set({ openTabs: tabs });
  },
  setOpenTabs: (tabs) => {
    set({ openTabs: tabs });
  },
  pinTab: (path) => {
    const tabs = [...get().openTabs];
    const index = tabs.findIndex((t) => t.path === path);
    if (index === -1) return;
    const [tab] = tabs.splice(index, 1);
    const pinnedTab = { ...tab, pinned: true };
    const lastPinnedIndex = tabs.reduce((acc, t, i) => (t.pinned ? i : acc), -1);
    tabs.splice(lastPinnedIndex + 1, 0, pinnedTab);
    set({ openTabs: tabs });
  },
  unpinTab: (path) => {
    const tabs = [...get().openTabs];
    const index = tabs.findIndex((t) => t.path === path);
    if (index === -1) return;
    const [tab] = tabs.splice(index, 1);
    const unpinnedTab = { ...tab, pinned: false };
    const lastPinnedIndex = tabs.reduce((acc, t, i) => (t.pinned ? i : acc), -1);
    tabs.splice(lastPinnedIndex + 1, 0, unpinnedTab);
    set({ openTabs: tabs });
  },
}));
