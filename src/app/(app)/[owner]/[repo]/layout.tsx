'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { FileTree } from '@/components/files/file-tree';
import { SyncButton } from '@/components/github/sync-button';
import { BranchSelector } from '@/components/github/branch-selector';
import { CommitDialog } from '@/components/github/commit-dialog';
import { PRDialog } from '@/components/github/pr-dialog';
import { CreateBranchDialog } from '@/components/github/create-branch-dialog';
import { AppHeader } from '@/components/layout/app-header';
import { AISidebar } from '@/components/ai/ai-sidebar';
import { VersionHistorySidebar } from '@/components/github/version-history-sidebar';
import { RightPanel } from '@/components/layout/right-panel';
import { ResponsiveSidebar } from '@/components/ui/responsive-sidebar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wand2, MessageSquare, History, SpellCheck, Minimize2, PanelRight } from 'lucide-react';
import type { RightPanelTab } from '@/stores/ui-store';
import { PRSelector } from '@/components/github/pr-selector';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGitHubTree, useGitHubBranches, useGitHubPulls, useGitHubContent, useCommitsPrefetch, useGitHubRepo } from '@/hooks/use-github';
import { useFileStore } from '@/stores/file-store';
import { useSyncStore } from '@/stores/sync-store';
import { useUIStore } from '@/stores/ui-store';
import type { FileNode, GitHubTreeItem, PendingFileOp } from '@/types';
import { isMarkdownFile } from '@/lib/editor/markdown-serializer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { CommandPalette } from '@/components/editor/command-palette';
import { KeyboardShortcutsDialog } from '@/components/editor/keyboard-shortcuts-dialog';
import { SettingsDialog, type SettingsTab } from '@/components/settings/settings-dialog';
import { TabBar } from '@/components/editor/tab-bar';
import { useTabPersistence } from '@/hooks/use-tab-persistence';
import { WritingChecks } from '@/components/editor/writing-checks';

function buildFileTree(items: GitHubTreeItem[]): FileNode[] {
  const root: FileNode[] = [];
  const dirMap = new Map<string, FileNode>();

  // Sort: directories first, then by name
  const sorted = [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'tree' ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const item of sorted) {
    const parts = item.path.split('/');
    const name = parts[parts.length - 1];
    const node: FileNode = {
      id: item.sha,
      path: item.path,
      name,
      type: item.type === 'tree' ? 'directory' : 'file',
      sha: item.sha,
      size: item.size,
      isMarkdown: item.type === 'blob' && isMarkdownFile(name),
      children: item.type === 'tree' ? [] : undefined,
    };

    if (item.type === 'tree') {
      dirMap.set(item.path, node);
    }

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = dirMap.get(parentPath);
      if (parent?.children) {
        parent.children.push(node);
      }
    }
  }

  return root;
}

function findNodeByPath(files: FileNode[], path: string): FileNode | null {
  for (const f of files) {
    if (f.path === path) return f;
    if (f.children) {
      const found = findNodeByPath(f.children, path);
      if (found) return found;
    }
  }
  return null;
}

export default function RepoLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const owner = params.owner as string;
  const repo = params.repo as string;

  const { tree, loading: treeLoading, fetchTree } = useGitHubTree();
  const { branches, fetchBranches, createBranch } = useGitHubBranches();
  const { setFiles, dirtyFiles, clearDirty, currentFile, pendingOps, addPendingOp, applyOpToTree, clearPendingOps, closeTab, originalContents, files: storeFiles } = useFileStore();
  useTabPersistence(owner, repo);
  const { currentBranch, setCurrentBranch, baseBranch, setBaseBranch, setBranches, startSync, finishSync, failSync, setActivePR, clearActivePR } = useSyncStore();
  const { fetchRepo } = useGitHubRepo();
  const { sidebarOpen, rightPanelOpen, rightPanelTab, toggleSidebar, toggleRightPanelTab, closeRightPanel, setSidebarOpen, activeCommentCount, sidebarWidth, setSidebarWidth, focusMode, setFocusMode, settingsDialogOpen, settingsDialogTab, openSettingsDialog, closeSettingsDialog, tabPanelStates } = useUIStore();
  const activeTabPath = useFileStore((s) => s.activeTabPath);
  const isMobile = useIsMobile();
  const isResizing = useRef(false);
  const { createPR, fetchPRForBranch } = useGitHubPulls();
  const { fetchContent, createContent, deleteContent, updateContent } = useGitHubContent();
  const prefetchCommits = useCommitsPrefetch();

  // Pre-fetch version history in background so it's ready when user opens the sidebar
  useEffect(() => {
    if (currentFile?.path) {
      prefetchCommits(owner, repo, currentFile.path);
    }
  }, [owner, repo, currentFile?.path, prefetchCommits]);

  // PR detection: check if current branch has an open PR (runs once per branch change, not per file)
  useEffect(() => {
    clearActivePR();
    const detect = async () => {
      try {
        const pr = await fetchPRForBranch(owner, repo, currentBranch);
        if (pr) setActivePR(pr);
      } catch {
        // Silent — PR detection is best-effort
      }
    };
    detect();
  }, [owner, repo, currentBranch, fetchPRForBranch, setActivePR, clearActivePR]);

  // Track which panel icon to show per file tab (persists across panel open/close)
  const lastPanelPerFile = useRef<Record<string, RightPanelTab>>({});

  // Save/restore per-tab sidebar state when switching tabs
  const prevTabPathRef = useRef<string | null>(activeTabPath);
  useEffect(() => {
    const prev = prevTabPathRef.current;
    if (activeTabPath && activeTabPath !== prev) {
      useUIStore.getState().switchTab(prev, activeTabPath);
    }
    prevTabPathRef.current = activeTabPath;
  }, [activeTabPath]);

  // Track which panel was last used per file (for dynamic header icon)
  useEffect(() => {
    if (currentFile?.path && rightPanelTab) {
      lastPanelPerFile.current[currentFile.path] = rightPanelTab;
    }
  }, [currentFile?.path, rightPanelTab]);

  // Fetch the repo's actual default branch from GitHub on mount
  useEffect(() => {
    fetchRepo(owner, repo)
      .then((repoData) => {
        if (repoData?.default_branch) {
          setBaseBranch(repoData.default_branch);
        }
      })
      .catch(() => {});
  }, [owner, repo, fetchRepo, setBaseBranch]);

  // Keep URL ?branch= param in sync with the current branch
  useEffect(() => {
    const url = new URL(window.location.href);
    const urlBranch = url.searchParams.get('branch');
    if (currentBranch && currentBranch !== baseBranch) {
      if (urlBranch !== currentBranch) {
        url.searchParams.set('branch', currentBranch);
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    } else if (urlBranch) {
      url.searchParams.delete('branch');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [currentBranch, baseBranch]);

  /** Build a repo-relative URL preserving the current branch param */
  const buildRepoUrl = useCallback(
    (path?: string) => {
      const base = `/${owner}/${repo}${path ? `/${path}` : ''}`;
      return currentBranch && currentBranch !== baseBranch
        ? `${base}?branch=${encodeURIComponent(currentBranch)}`
        : base;
    },
    [owner, repo, currentBranch, baseBranch]
  );

  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [prDialogOpen, setPRDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null);
  const [busyPaths, setBusyPaths] = useState<Set<string>>(new Set());
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Listen for '?' key to open keyboard shortcuts dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const addBusy = useCallback((path: string) => {
    setBusyPaths((prev) => new Set(prev).add(path));
  }, []);

  const removeBusy = useCallback((path: string) => {
    setBusyPaths((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  useEffect(() => {
    if (owner && repo) {
      fetchTree(owner, repo, currentBranch).then((treeItems) => {
        if (treeItems) {
          const fileTree = buildFileTree(treeItems);
          setFiles(fileTree);
        }
      });
      fetchBranches(owner, repo).then((b) => {
        if (b) setBranches(b.map((br: { name: string }) => br.name));
      });
    }
  }, [owner, repo, currentBranch]);

  const handleFileSelect = useCallback(
    (node: FileNode) => {
      router.push(buildRepoUrl(node.path));
      if (isMobile) setSidebarOpen(false);
    },
    [buildRepoUrl, router, isMobile, setSidebarOpen]
  );

  const handleBranchChange = useCallback(
    (branch: string) => {
      setCurrentBranch(branch);
    },
    [setCurrentBranch]
  );

  const handlePull = async () => {
    await fetchTree(owner, repo, currentBranch);
    toast.success('Pulled latest changes');
  };

  const handlePush = async () => {
    setCommitDialogOpen(true);
  };

  const handleCommit = async (message: string, description: string) => {
    startSync();
    try {
      const ops = useFileStore.getState().pendingOps;
      const dirty = useFileStore.getState().dirtyFiles;

      if (ops.length === 0 && dirty.size === 0) {
        toast.info('No changes to commit');
        finishSync('');
        return;
      }

      const commitMsg = description ? `${message}\n\n${description}` : message;
      let errors = 0;

      // Execute pending operations in order: creates first, then renames/moves, then deletes
      const creates = ops.filter(op => op.type === 'create' || op.type === 'duplicate');
      const renames = ops.filter(op => op.type === 'rename' || op.type === 'move');
      const deletes = ops.filter(op => op.type === 'delete');

      for (const op of creates) {
        try {
          const path = op.type === 'create' ? op.path : op.newPath;
          await createContent(owner, repo, path, op.content, commitMsg, currentBranch);
        } catch { errors++; }
      }

      for (const op of renames) {
        try {
          await createContent(owner, repo, op.newPath, op.content, commitMsg, currentBranch);
          await deleteContent(owner, repo, op.oldPath, op.sha, commitMsg, currentBranch);
        } catch { errors++; }
      }

      for (const op of deletes) {
        try {
          await deleteContent(owner, repo, op.path, op.sha, commitMsg, currentBranch);
        } catch { errors++; }
      }

      // Commit dirty file content changes
      for (const filePath of dirty) {
        try {
          const fileNode = findNodeByPath(useFileStore.getState().files, filePath);
          if (fileNode?.content != null && fileNode.sha) {
            await updateContent(owner, repo, filePath, fileNode.content, commitMsg, fileNode.sha, currentBranch);
          }
        } catch { errors++; }
      }

      // Clear everything and refresh
      clearPendingOps();
      clearDirty();
      await refreshTree();

      if (errors > 0) {
        toast.warning(`Committed with ${errors} error(s). Some operations may have failed.`);
      } else {
        const total = ops.length + dirty.size;
        toast.success(`Committed ${total} change${total !== 1 ? 's' : ''} to GitHub`);
      }
      finishSync('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Commit failed';
      failSync(msg);
      toast.error(msg);
    }
  };

  const handleCreatePR = async (title: string, body: string, head: string, base: string) => {
    try {
      const result = await createPR(owner, repo, title, body, head, base);
      toast.success('Pull request created!');
      if (result?.html_url) {
        window.open(result.html_url, '_blank');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create PR';
      toast.error(msg);
    }
  };

  const handleCreateBranch = useCallback(() => {
    setBranchDialogOpen(true);
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isResizing.current) return;
        const newWidth = startWidth + (ev.clientX - startX);
        setSidebarWidth(newWidth);
      };

      const onMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [sidebarWidth, setSidebarWidth]
  );

  const refreshTree = useCallback(async () => {
    const treeItems = await fetchTree(owner, repo, currentBranch);
    if (treeItems) {
      setFiles(buildFileTree(treeItems));
    }
  }, [owner, repo, currentBranch, fetchTree, setFiles]);

  const handleDuplicateFile = useCallback(async (node: FileNode) => {
    addBusy(node.path);
    try {
      const file = await fetchContent(owner, repo, node.path, currentBranch);
      const content = file.content ? new TextDecoder().decode(Uint8Array.from(atob(file.content), c => c.charCodeAt(0))) : '';
      const dir = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/') + 1) : '';
      const baseName = node.name.replace(/\.md$/, '');
      let newName = `${baseName}-copy.md`;
      let newPath = `${dir}${newName}`;
      let counter = 2;
      const existingPaths = new Set<string>();
      const collectPaths = (nodes: FileNode[]) => {
        for (const n of nodes) {
          existingPaths.add(n.path);
          if (n.children) collectPaths(n.children);
        }
      };
      collectPaths(useFileStore.getState().files);
      while (existingPaths.has(newPath)) {
        newName = `${baseName}-copy-${counter}.md`;
        newPath = `${dir}${newName}`;
        counter++;
      }
      const op: PendingFileOp = { type: 'duplicate', newPath, content };
      addPendingOp(op);
      applyOpToTree(op);
      router.push(buildRepoUrl(newPath));
      toast.success(`Duplicated as ${newName} (pending commit)`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to duplicate file';
      toast.error(msg);
    } finally {
      removeBusy(node.path);
    }
  }, [owner, repo, currentBranch, fetchContent, addPendingOp, applyOpToTree, router, buildRepoUrl, addBusy, removeBusy]);

  const handleRenameFile = useCallback(async (node: FileNode, newName: string) => {
    addBusy(node.path);
    try {
      const file = await fetchContent(owner, repo, node.path, currentBranch);
      const content = file.content ? new TextDecoder().decode(Uint8Array.from(atob(file.content), c => c.charCodeAt(0))) : '';
      const dir = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/') + 1) : '';
      const newPath = `${dir}${newName}`;
      closeTab(node.path);
      const op: PendingFileOp = { type: 'rename', oldPath: node.path, newPath, sha: file.sha, content };
      addPendingOp(op);
      applyOpToTree(op);
      if (currentFile?.path === node.path) {
        router.push(buildRepoUrl(newPath));
      }
      toast.success(`Renamed to ${newName} (pending commit)`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to rename file';
      toast.error(msg);
    } finally {
      removeBusy(node.path);
    }
  }, [owner, repo, currentBranch, fetchContent, addPendingOp, applyOpToTree, closeTab, router, buildRepoUrl, currentFile, addBusy, removeBusy]);

  const handleDeleteFile = useCallback((node: FileNode) => {
    const op: PendingFileOp = { type: 'delete', path: node.path, sha: node.sha || '' };
    addPendingOp(op);
    applyOpToTree(op);
    closeTab(node.path);
    if (currentFile?.path === node.path) {
      router.push(buildRepoUrl());
    }
    toast.success(`Deleted ${node.name} (pending commit)`);
    setDeleteTarget(null);
  }, [addPendingOp, applyOpToTree, closeTab, router, buildRepoUrl, currentFile]);

  const handleNewFile = useCallback((name: string) => {
    const op: PendingFileOp = { type: 'create', path: name, content: '' };
    addPendingOp(op);
    applyOpToTree(op);
    router.push(buildRepoUrl(name));
    toast.success(`Created ${name} (pending commit)`);
  }, [addPendingOp, applyOpToTree, router, buildRepoUrl]);

  const handleNewFolder = useCallback((folderName: string) => {
    const filePath = `${folderName}/untitled.md`;
    const op: PendingFileOp = { type: 'create', path: filePath, content: '' };
    addPendingOp(op);
    applyOpToTree(op);
    router.push(buildRepoUrl(filePath));
    toast.success(`Created folder ${folderName} (pending commit)`);
  }, [addPendingOp, applyOpToTree, router, buildRepoUrl]);

  const handleMoveFile = useCallback(async (node: FileNode, targetDir: string) => {
    addBusy(node.path);
    try {
      const newPath = `${targetDir}/${node.name}`;
      // Check if target already exists
      const existingPaths = new Set<string>();
      const collectPaths = (nodes: FileNode[]) => {
        for (const n of nodes) {
          existingPaths.add(n.path);
          if (n.children) collectPaths(n.children);
        }
      };
      collectPaths(useFileStore.getState().files);
      if (existingPaths.has(newPath)) {
        toast.error(`A file named "${node.name}" already exists in ${targetDir}`);
        return;
      }
      const file = await fetchContent(owner, repo, node.path, currentBranch);
      const content = file.content ? new TextDecoder().decode(Uint8Array.from(atob(file.content), c => c.charCodeAt(0))) : '';
      closeTab(node.path);
      const op: PendingFileOp = { type: 'move', oldPath: node.path, newPath, sha: file.sha, content };
      addPendingOp(op);
      applyOpToTree(op);
      if (currentFile?.path === node.path) {
        router.push(buildRepoUrl(newPath));
      }
      toast.success(`Moved to ${targetDir}/ (pending commit)`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to move file';
      toast.error(msg);
    } finally {
      removeBusy(node.path);
    }
  }, [owner, repo, currentBranch, fetchContent, addPendingOp, applyOpToTree, closeTab, router, buildRepoUrl, currentFile, addBusy, removeBusy]);

  const handleDropFiles = useCallback((droppedFiles: { name: string; content: string }[]) => {
    const existingPaths = new Set<string>();
    const collectPaths = (nodes: FileNode[]) => {
      for (const n of nodes) {
        existingPaths.add(n.path);
        if (n.children) collectPaths(n.children);
      }
    };
    collectPaths(useFileStore.getState().files);

    let lastPath = '';
    for (const file of droppedFiles) {
      let finalName = file.name;
      if (existingPaths.has(finalName)) {
        const baseName = finalName.replace(/\.md$/, '');
        let counter = 2;
        while (existingPaths.has(`${baseName}-${counter}.md`)) counter++;
        finalName = `${baseName}-${counter}.md`;
      }
      const op: PendingFileOp = { type: 'create', path: finalName, content: file.content };
      addPendingOp(op);
      applyOpToTree(op);
      existingPaths.add(finalName);
      lastPath = finalName;
    }

    if (lastPath) {
      router.push(buildRepoUrl(lastPath));
      toast.success(`Added ${droppedFiles.length} file${droppedFiles.length > 1 ? 's' : ''} (pending commit)`);
    }
  }, [addPendingOp, applyOpToTree, router, buildRepoUrl]);

  const handleCreateBranchSubmit = useCallback(async (name: string) => {
    // Get the SHA of the current branch head
    const branchList = await fetchBranches(owner, repo);
    const current = branchList?.find((b: { name: string; commit: { sha: string } }) => b.name === currentBranch);
    if (!current) {
      throw new Error('Could not find current branch');
    }
    await createBranch(owner, repo, name, current.commit.sha);
    // Refresh branches list and switch to new branch
    const updated = await fetchBranches(owner, repo);
    if (updated) setBranches(updated.map((br: { name: string }) => br.name));
    setCurrentBranch(name);
    toast.success(`Created branch: ${name}`);
  }, [owner, repo, currentBranch, fetchBranches, createBranch, setBranches, setCurrentBranch]);

  return (
    <div className="flex h-screen w-full flex-col" data-focus-mode={focusMode ? 'true' : undefined}>
      {/* Floating exit focus mode button */}
      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          className="focus-mode-exit-btn"
          aria-label="Exit focus mode"
        >
          <Minimize2 className="h-3.5 w-3.5 mr-1.5" />
          Exit focus mode
        </button>
      )}
      <AppHeader
        repoContext={{ owner, repo, sidebarOpen, onToggleSidebar: toggleSidebar, filePath: currentFile?.path }}
        breadcrumbSlot={
          <BranchSelector onBranchChange={handleBranchChange} onCreateBranch={handleCreateBranch} />
        }
        actions={
          <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-0.5">
            {(() => {
              const PANEL_ICONS: Record<RightPanelTab, { icon: typeof History; label: string }> = {
                versions: { icon: History, label: 'Version History' },
                comments: { icon: MessageSquare, label: 'Comments' },
                checks: { icon: SpellCheck, label: currentFile?.isMarkdown === false ? 'Code Review' : 'Writing Checks' },
                ai: { icon: Wand2, label: 'AI Assistant' },
              };
              // When panel is closed: show the per-file saved icon (hint of what will open)
              // When panel is open: show stable PanelRight icon (avoids flickering as user switches tabs)
              const savedTab = currentFile?.path ? lastPanelPerFile.current[currentFile.path] ?? null : null;
              const displayTab: RightPanelTab | null = rightPanelOpen ? null : (savedTab ?? rightPanelTab);
              const clickTab: RightPanelTab = savedTab ?? rightPanelTab ?? 'ai';
              const DisplayIcon = displayTab ? PANEL_ICONS[displayTab].icon : PanelRight;
              const label = displayTab ? PANEL_ICONS[displayTab].label : 'Panel';
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid="toggle-right-panel"
                      aria-label={rightPanelOpen ? `Close ${label}` : `Open ${label}`}
                      className="h-8 w-8 relative"
                      onClick={() => {
                        if (rightPanelOpen) closeRightPanel();
                        else toggleRightPanelTab(clickTab);
                      }}
                    >
                      <DisplayIcon className="h-[18px] w-[18px]" />
                      {displayTab === 'comments' && activeCommentCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                          {activeCommentCount > 99 ? '99+' : activeCommentCount}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">{label}</p></TooltipContent>
                </Tooltip>
              );
            })()}
            <PRSelector owner={owner} repo={repo} onBranchChange={handleBranchChange} />
            <SyncButton onPull={handlePull} onPush={handlePush} onCreatePR={() => setPRDialogOpen(true)} onCreateBranch={handleCreateBranch} onOpenAutoSaveSettings={() => openSettingsDialog('auto-save')} />
          </div>
          </TooltipProvider>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        <ResponsiveSidebar isOpen={sidebarOpen && !focusMode} onClose={toggleSidebar} side="left" title={`${owner}/${repo}`}>
          <div className="relative h-full shrink-0 border-r bg-background transition-[width] duration-200 ease-out" style={{ width: isMobile ? undefined : sidebarWidth }}>
            <FileTree
              owner={owner}
              repo={repo}
              onFileSelect={handleFileSelect}
              onDuplicate={handleDuplicateFile}
              onRename={handleRenameFile}
              onDelete={(node) => setDeleteTarget(node)}
              onMoveFile={handleMoveFile}
              onNewFile={handleNewFile}
              onNewFolder={handleNewFolder}
              onDropFiles={handleDropFiles}
              busyPaths={busyPaths}
            />
            {/* Resize handle — desktop only */}
            {!isMobile && (
              <div
                onMouseDown={handleResizeStart}
                className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
              />
            )}
          </div>
        </ResponsiveSidebar>
        <main data-testid="main-content" aria-label="Document content" className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <TabBar owner={owner} repo={repo} buildRepoUrl={buildRepoUrl} onNewFile={handleNewFile} />
          <div className="flex-1 min-w-0 overflow-auto">{children}</div>
        </main>
        {/* Unified right panel — contains AI, Version History, Checks; Comments rendered from page.tsx */}
        <ResponsiveSidebar isOpen={rightPanelOpen && !focusMode} onClose={closeRightPanel} side="right" title="Panel">
          <RightPanel
            activeTab={rightPanelTab}
            onTabChange={toggleRightPanelTab}
            onClose={closeRightPanel}
            activeCommentCount={activeCommentCount}
          >
            {/* Version History */}
            {rightPanelTab === 'versions' && (
              <VersionHistorySidebar
                isOpen={true}
                onClose={closeRightPanel}
                owner={owner}
                repo={repo}
                filePath={currentFile?.path}
              />
            )}

            {/* Writing Checks / Code Review */}
            {rightPanelTab === 'checks' && (
              <WritingChecks
                isOpen={true}
                onClose={closeRightPanel}
                content={currentFile?.content ?? ''}
                onApplyFix={(oldText, newText) => {
                  useUIStore.getState().setPendingTextEdit({ oldText, newText });
                }}
                mode={currentFile?.isMarkdown === false ? 'code' : 'writing'}
                filename={currentFile?.path}
              />
            )}

            {/* AI Sidebar — always mounted (hidden via CSS) to preserve chat state */}
            <div className={rightPanelTab === 'ai' ? 'h-full' : 'hidden'}>
              <AISidebar isOpen={rightPanelOpen && rightPanelTab === 'ai'} onClose={closeRightPanel} />
            </div>

            {/* Comments are rendered from page.tsx via portal — always mounted so the portal target exists */}
            <div data-testid="right-panel-comments-slot" className={rightPanelTab === 'comments' ? 'h-full' : 'hidden'}>
              {rightPanelTab === 'comments' && !currentFile && (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No comments yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Open a file to view and add comments</p>
                  </div>
                </div>
              )}
            </div>
          </RightPanel>
        </ResponsiveSidebar>
      </div>
      <CommitDialog
        open={commitDialogOpen}
        onOpenChange={setCommitDialogOpen}
        onCommit={handleCommit}
        changedFiles={Array.from(dirtyFiles).map((path) => {
          const fileNode = findNodeByPath(storeFiles, path);
          const original = originalContents.get(path) ?? '';
          const current = fileNode?.content ?? '';
          return { path, original, current };
        })}
        pendingOps={pendingOps}
      />
      <PRDialog
        open={prDialogOpen}
        onOpenChange={setPRDialogOpen}
        onCreatePR={handleCreatePR}
        owner={owner}
        repo={repo}
      />
      <CreateBranchDialog
        open={branchDialogOpen}
        onOpenChange={setBranchDialogOpen}
        onCreateBranch={handleCreateBranchSubmit}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the file from the repository. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteTarget && handleDeleteFile(deleteTarget)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CommandPalette onOpenShortcuts={() => setShortcutsOpen(true)} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <SettingsDialog open={settingsDialogOpen} onOpenChange={(open) => open ? openSettingsDialog() : closeSettingsDialog()} initialTab={(settingsDialogTab as SettingsTab) ?? undefined} />
    </div>
  );
}
