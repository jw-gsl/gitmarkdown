'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FileTree } from '@/components/files/file-tree';
import { SyncButton } from '@/components/github/sync-button';
import { BranchSelector } from '@/components/github/branch-selector';
import { CommitDialog } from '@/components/github/commit-dialog';
import { PRDialog } from '@/components/github/pr-dialog';
import { AppHeader } from '@/components/layout/app-header';
import { AISidebar } from '@/components/ai/ai-sidebar';
import { Button } from '@/components/ui/button';
import { Sparkles, MessageSquare, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useGitHubTree, useGitHubBranches } from '@/hooks/use-github';
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
  const { branches, fetchBranches } = useGitHubBranches();
  const { setFiles, dirtyFiles } = useFileStore();
  const { currentBranch, setCurrentBranch, setBranches } = useSyncStore();
  const { sidebarOpen, aiSidebarOpen, toggleSidebar, toggleAISidebar, toggleCommentSidebar } = useUIStore();

  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [prDialogOpen, setPRDialogOpen] = useState(false);

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
    },
    [owner, repo, router]
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
    toast.success('Changes pushed to GitHub');
  };

  const handleCreatePR = async (title: string, body: string, head: string, base: string) => {
    toast.success('Pull request created');
  };

  return (
    <div className="flex h-screen w-full flex-col">
      <AppHeader />
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSidebar}>
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </Button>
        <span className="text-sm font-medium">{owner}/{repo}</span>
        <div className="ml-auto flex items-center gap-2">
          <BranchSelector onBranchChange={handleBranchChange} onCreateBranch={() => {}} />
          <SyncButton onPull={handlePull} onPush={handlePush} onCreatePR={() => setPRDialogOpen(true)} />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleCommentSidebar}>
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleAISidebar}>
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="w-64 shrink-0 border-r">
            <FileTree onFileSelect={handleFileSelect} />
          </div>
        )}
        <main className="flex-1 overflow-auto">{children}</main>
        <AISidebar isOpen={aiSidebarOpen} onClose={toggleAISidebar} />
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
    </div>
  );
}
