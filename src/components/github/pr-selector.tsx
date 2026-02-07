'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { GitPullRequest, Check, Search, ExternalLink, ArrowRight } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSyncStore } from '@/stores/sync-store';
import { useFileStore } from '@/stores/file-store';
import { useGitHubOpenPRs } from '@/hooks/use-github';
import { UnsavedChangesDialog } from '@/components/github/unsaved-changes-dialog';
import type { GitHubPullRequest } from '@/types';

interface PRSelectorProps {
  owner: string;
  repo: string;
  onBranchChange: (branch: string) => void;
}

export function PRSelector({ owner, repo, onBranchChange }: PRSelectorProps) {
  const { activePR } = useSyncStore();
  const { dirtyFiles } = useFileStore();
  const { prs, loading, fetchOpenPRs } = useGitHubOpenPRs();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch open PRs when popover opens
  useEffect(() => {
    if (open) {
      fetchOpenPRs(owner, repo);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearch('');
    }
  }, [open, owner, repo, fetchOpenPRs]);

  const filteredPRs = useMemo(() => {
    if (!search.trim()) return prs;
    const q = search.toLowerCase();
    return prs.filter(
      (pr) =>
        pr.title.toLowerCase().includes(q) ||
        String(pr.number).includes(q)
    );
  }, [prs, search]);

  const handleSelect = (pr: GitHubPullRequest) => {
    if (pr.number === activePR?.number) {
      setOpen(false);
      return;
    }
    if (dirtyFiles.size > 0) {
      setPendingBranch(pr.head.ref);
      setOpen(false);
      return;
    }
    onBranchChange(pr.head.ref);
    setOpen(false);
  };

  const handleDiscardAndSwitch = () => {
    if (pendingBranch) {
      onBranchChange(pendingBranch);
      setPendingBranch(null);
    }
  };

  if (!activePR) return null;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <GitPullRequest className="h-3.5 w-3.5" />
                  <span>#{activePR.number}</span>
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Switch pull request</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
          {/* Search */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pull requests..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* PR list */}
          <div className="max-h-60 overflow-y-auto py-1">
            {loading ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Loading...
              </div>
            ) : filteredPRs.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No open pull requests found
              </div>
            ) : (
              filteredPRs.map((pr) => (
                <button
                  key={pr.number}
                  onClick={() => handleSelect(pr)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                >
                  <span className="w-4 shrink-0 pt-0.5">
                    {pr.number === activePR.number && <Check className="h-3.5 w-3.5 text-primary" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground shrink-0">#{pr.number}</span>
                      <span className="text-sm truncate">{pr.title}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[100px]">{pr.head.ref}</span>
                      <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate max-w-[100px]">{pr.base.ref}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* View on GitHub */}
          <div className="border-t px-1 py-1">
            <a
              href={activePR.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>View on GitHub</span>
            </a>
          </div>
        </PopoverContent>
      </Popover>

      <UnsavedChangesDialog
        open={!!pendingBranch}
        onOpenChange={(isOpen) => { if (!isOpen) setPendingBranch(null); }}
        onDiscard={handleDiscardAndSwitch}
        dirtyFiles={Array.from(dirtyFiles)}
        description={`Switching to ${pendingBranch ?? 'another branch'} will discard your unsaved changes.`}
        actionLabel="Discard & switch"
      />
    </>
  );
}
