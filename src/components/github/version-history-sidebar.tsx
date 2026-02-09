'use client';

import { useEffect, useCallback } from 'react';
import { VersionHistory } from './version-history';
import { useGitHubCommits } from '@/hooks/use-github';
import { useUIStore } from '@/stores/ui-store';
import { toast } from 'sonner';

interface VersionHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  owner: string;
  repo: string;
  filePath?: string;
}

export function VersionHistorySidebar({
  isOpen,
  onClose,
  owner,
  repo,
  filePath,
}: VersionHistorySidebarProps) {
  const { commits, loading, fetchCommits } = useGitHubCommits();
  const { setDiffViewCommitSha } = useUIStore();

  useEffect(() => {
    if (isOpen && owner && repo) {
      // Fetch with stats — the hook shows cached data immediately while refreshing
      fetchCommits(owner, repo, filePath, { includeStats: true });
    }
  }, [isOpen, owner, repo, filePath, fetchCommits]);

  const { diffViewCommitSha } = useUIStore();

  const handleSelectCommit = useCallback(
    (sha: string) => {
      // Toggle: click again to deselect
      setDiffViewCommitSha(diffViewCommitSha === sha ? null : sha);
    },
    [setDiffViewCommitSha, diffViewCommitSha]
  );

  const handleRestore = useCallback(
    (sha: string) => {
      toast.info(`Restore to ${sha.slice(0, 7)} — not yet implemented`);
    },
    []
  );

  if (!isOpen) return null;

  return (
    <aside data-testid="version-history-sidebar" aria-label="Version history" className="flex h-full w-full flex-col bg-background">
      {filePath && (
        <div className="border-b px-4 py-2">
          <p className="text-xs text-muted-foreground truncate">{filePath}</p>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <VersionHistory
          commits={commits}
          loading={loading}
          onSelectCommit={handleSelectCommit}
          selectedSha={diffViewCommitSha}
          onRestore={handleRestore}
          owner={owner}
          repo={repo}
        />
      </div>
    </aside>
  );
}
