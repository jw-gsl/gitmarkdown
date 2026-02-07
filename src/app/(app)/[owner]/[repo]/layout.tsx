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
import { ResponsiveSidebar } from '@/components/ui/responsive-sidebar';
import { Button } from '@/components/ui/button';
import { Wand2, MessageSquare, History } from 'lucide-react';
import { PRSelector } from '@/components/github/pr-selector';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGitHubTree, useGitHubBranches, useGitHubPulls, useGitHubContent, useCommitsPrefetch, useGitHubRepo } from '@/hooks/use-github';
import { useFileStore } from '@/stores/file-store';
import { useSyncStore } from '@/stores/sync-store';
import { useUIStore } from '@/stores/ui-store';
import type { FileNode, GitHubTreeItem } from '@/types';
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

export default function RepoLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const owner = params.owner as string;
  const repo = params.repo as string;

  const { tree, loading: treeLoading, fetchTree } = useGitHubTree();
  const { branches, fetchBranches, createBranch } = useGitHubBranches();
  const { setFiles, dirtyFiles, clearDirty, currentFile } = useFileStore();
  const { currentBranch, setCurrentBranch, baseBranch, setBaseBranch, setBranches, startSync, finishSync, failSync } = useSyncStore();
  const { fetchRepo } = useGitHubRepo();
  const { sidebarOpen, aiSidebarOpen, versionHistoryOpen, toggleSidebar, toggleAISidebar, toggleCommentSidebar, toggleVersionHistory, setSidebarOpen, activeCommentCount, sidebarWidth, setSidebarWidth } = useUIStore();
  const isMobile = useIsMobile();
  const isResizing = useRef(false);
  const { createPR } = useGitHubPulls();
  const { fetchContent, createContent, deleteContent } = useGitHubContent();
  const prefetchCommits = useCommitsPrefetch();

  // Pre-fetch version history in background so it's ready when user opens the sidebar
  useEffect(() => {
    if (currentFile?.path) {
      prefetchCommits(owner, repo, currentFile.path);
    }
  }, [owner, repo, currentFile?.path, prefetchCommits]);

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
      // The auto-save already commits files individually.
      // This manual commit just confirms the latest state is saved.
      // If there are dirty files, trigger a save for the current file.
      if (dirtyFiles.size === 0) {
        toast.info('All changes already saved to GitHub');
        finishSync('');
        return;
      }
      toast.success(`Committed ${dirtyFiles.size} file(s) to GitHub`);
      clearDirty();
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
      await createContent(owner, repo, newPath, content, `Duplicate ${node.path}`, currentBranch);
      await refreshTree();
      router.push(buildRepoUrl(newPath));
      toast.success(`Duplicated as ${newName}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to duplicate file';
      toast.error(msg);
    } finally {
      removeBusy(node.path);
    }
  }, [owner, repo, currentBranch, fetchContent, createContent, refreshTree, router, buildRepoUrl, addBusy, removeBusy]);

  const handleRenameFile = useCallback(async (node: FileNode, newName: string) => {
    addBusy(node.path);
    try {
      const file = await fetchContent(owner, repo, node.path, currentBranch);
      const content = file.content ? new TextDecoder().decode(Uint8Array.from(atob(file.content), c => c.charCodeAt(0))) : '';
      const dir = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/') + 1) : '';
      const newPath = `${dir}${newName}`;
      await createContent(owner, repo, newPath, content, `Rename ${node.path} → ${newPath}`, currentBranch);
      await deleteContent(owner, repo, node.path, file.sha, `Rename ${node.path} → ${newPath}`, currentBranch);
      await refreshTree();
      if (currentFile?.path === node.path) {
        router.push(buildRepoUrl(newPath));
      }
      toast.success(`Renamed to ${newName}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to rename file';
      toast.error(msg);
    } finally {
      removeBusy(node.path);
    }
  }, [owner, repo, currentBranch, fetchContent, createContent, deleteContent, refreshTree, router, buildRepoUrl, currentFile, addBusy, removeBusy]);

  const handleDeleteFile = useCallback(async (node: FileNode) => {
    addBusy(node.path);
    try {
      const file = await fetchContent(owner, repo, node.path, currentBranch);
      await deleteContent(owner, repo, node.path, file.sha, `Delete ${node.path}`, currentBranch);
      await refreshTree();
      if (currentFile?.path === node.path) {
        router.push(buildRepoUrl());
      }
      toast.success(`Deleted ${node.name}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to delete file';
      toast.error(msg);
    } finally {
      removeBusy(node.path);
      setDeleteTarget(null);
    }
  }, [owner, repo, currentBranch, fetchContent, deleteContent, refreshTree, router, buildRepoUrl, currentFile, addBusy, removeBusy]);

  const handleNewFile = useCallback(async (name: string) => {
    addBusy(name);
    try {
      await createContent(owner, repo, name, '', `Create ${name}`, currentBranch);
      await refreshTree();
      router.push(buildRepoUrl(name));
      toast.success(`Created ${name}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create file';
      toast.error(msg);
    } finally {
      removeBusy(name);
    }
  }, [owner, repo, currentBranch, createContent, refreshTree, router, buildRepoUrl, addBusy, removeBusy]);

  const handleNewFolder = useCallback(async (folderName: string) => {
    const filePath = `${folderName}/untitled.md`;
    addBusy(filePath);
    try {
      await createContent(owner, repo, filePath, '', `Create ${filePath}`, currentBranch);
      await refreshTree();
      router.push(buildRepoUrl(filePath));
      toast.success(`Created folder ${folderName}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create folder';
      toast.error(msg);
    } finally {
      removeBusy(filePath);
    }
  }, [owner, repo, currentBranch, createContent, refreshTree, router, buildRepoUrl, addBusy, removeBusy]);

  const handleDropFiles = useCallback(async (droppedFiles: { name: string; content: string }[]) => {
    const toastId = toast.loading(`Uploading ${droppedFiles.length} file${droppedFiles.length > 1 ? 's' : ''}...`);
    const existingPaths = new Set<string>();
    const collectPaths = (nodes: FileNode[]) => {
      for (const n of nodes) {
        existingPaths.add(n.path);
        if (n.children) collectPaths(n.children);
      }
    };
    collectPaths(useFileStore.getState().files);

    let created = 0;
    let lastPath = '';
    for (const file of droppedFiles) {
      let finalName = file.name;
      // Deduplicate if file already exists
      if (existingPaths.has(finalName)) {
        const baseName = finalName.replace(/\.md$/, '');
        let counter = 2;
        while (existingPaths.has(`${baseName}-${counter}.md`)) counter++;
        finalName = `${baseName}-${counter}.md`;
      }
      try {
        await createContent(owner, repo, finalName, file.content, `Upload ${finalName}`, currentBranch);
        existingPaths.add(finalName);
        lastPath = finalName;
        created++;
      } catch {
        // Continue with remaining files
      }
    }

    toast.dismiss(toastId);
    if (created > 0) {
      await refreshTree();
      if (lastPath) router.push(buildRepoUrl(lastPath));
      toast.success(`Uploaded ${created} file${created > 1 ? 's' : ''}`);
    } else {
      toast.error('Failed to upload files');
    }
  }, [owner, repo, currentBranch, createContent, refreshTree, router, buildRepoUrl]);

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
    <div className="flex h-screen w-full flex-col">
      <AppHeader
        repoContext={{ owner, repo, sidebarOpen, onToggleSidebar: toggleSidebar, filePath: currentFile?.path }}
        breadcrumbSlot={
          <BranchSelector onBranchChange={handleBranchChange} onCreateBranch={handleCreateBranch} />
        }
        actions={
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleVersionHistory}>
              <History className="h-[18px] w-[18px]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={toggleCommentSidebar}>
              <MessageSquare className="h-[18px] w-[18px]" />
              {activeCommentCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {activeCommentCount > 99 ? '99+' : activeCommentCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleAISidebar}>
              <Wand2 className="h-[18px] w-[18px]" />
            </Button>
            <PRSelector owner={owner} repo={repo} onBranchChange={handleBranchChange} />
            <SyncButton onPull={handlePull} onPush={handlePush} onCreatePR={() => setPRDialogOpen(true)} onCreateBranch={handleCreateBranch} />
          </div>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        <ResponsiveSidebar isOpen={sidebarOpen} onClose={toggleSidebar} side="left" title="Files">
          <div className="relative h-full shrink-0 border-r bg-background" style={{ width: isMobile ? undefined : sidebarWidth }}>
            <FileTree
              onFileSelect={handleFileSelect}
              onDuplicate={handleDuplicateFile}
              onRename={handleRenameFile}
              onDelete={(node) => setDeleteTarget(node)}
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
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
        <ResponsiveSidebar isOpen={versionHistoryOpen} onClose={toggleVersionHistory} side="right" title="Version History">
          <VersionHistorySidebar
            isOpen={versionHistoryOpen}
            onClose={toggleVersionHistory}
            owner={owner}
            repo={repo}
            filePath={currentFile?.path}
          />
        </ResponsiveSidebar>
        <ResponsiveSidebar isOpen={aiSidebarOpen} onClose={toggleAISidebar} side="right" title="AI Assistant">
          <AISidebar isOpen={aiSidebarOpen} onClose={toggleAISidebar} />
        </ResponsiveSidebar>
      </div>
      <CommitDialog
        open={commitDialogOpen}
        onOpenChange={setCommitDialogOpen}
        onCommit={handleCommit}
        changedFiles={Array.from(dirtyFiles)}
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
    </div>
  );
}
