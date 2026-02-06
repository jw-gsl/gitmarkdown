'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Sparkles, MessageSquare, History } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGitHubTree, useGitHubBranches, useGitHubPulls, useCommitsPrefetch } from '@/hooks/use-github';
import { useFileStore } from '@/stores/file-store';
import { useSyncStore } from '@/stores/sync-store';
import { useUIStore } from '@/stores/ui-store';
import type { FileNode, GitHubTreeItem } from '@/types';
import { isMarkdownFile } from '@/lib/editor/markdown-serializer';
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
  const owner = params.owner as string;
  const repo = params.repo as string;

  const { tree, loading: treeLoading, fetchTree } = useGitHubTree();
  const { branches, fetchBranches, createBranch } = useGitHubBranches();
  const { setFiles, dirtyFiles, clearDirty, currentFile } = useFileStore();
  const { currentBranch, setCurrentBranch, setBranches, startSync, finishSync, failSync } = useSyncStore();
  const { sidebarOpen, aiSidebarOpen, versionHistoryOpen, toggleSidebar, toggleAISidebar, toggleCommentSidebar, toggleVersionHistory, setSidebarOpen, activeCommentCount, sidebarWidth, setSidebarWidth } = useUIStore();
  const isMobile = useIsMobile();
  const isResizing = useRef(false);
  const { createPR } = useGitHubPulls();
  const prefetchCommits = useCommitsPrefetch();

  // Pre-fetch version history in background so it's ready when user opens the sidebar
  useEffect(() => {
    if (currentFile?.path) {
      prefetchCommits(owner, repo, currentFile.path);
    }
  }, [owner, repo, currentFile?.path, prefetchCommits]);

  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [prDialogOpen, setPRDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);

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
      router.push(`/${owner}/${repo}/${node.path}`);
      if (isMobile) setSidebarOpen(false);
    },
    [owner, repo, router, isMobile, setSidebarOpen]
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
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={toggleCommentSidebar}>
              <MessageSquare className="h-4 w-4" />
              {activeCommentCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {activeCommentCount > 99 ? '99+' : activeCommentCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleVersionHistory}>
              <History className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleAISidebar}>
              <Sparkles className="h-4 w-4" />
            </Button>
            <SyncButton onPull={handlePull} onPush={handlePush} onCreatePR={() => setPRDialogOpen(true)} onCreateBranch={handleCreateBranch} />
          </>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        <ResponsiveSidebar isOpen={sidebarOpen} onClose={toggleSidebar} side="left" title="Files">
          <div className="relative h-full shrink-0 border-r bg-background" style={{ width: isMobile ? undefined : sidebarWidth }}>
            <FileTree onFileSelect={handleFileSelect} />
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
      />
      <CreateBranchDialog
        open={branchDialogOpen}
        onOpenChange={setBranchDialogOpen}
        onCreateBranch={handleCreateBranchSubmit}
      />
    </div>
  );
}
