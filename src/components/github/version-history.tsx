'use client';

import { useState } from 'react';
import { History, RotateCcw, Plus, Minus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
import type { GitHubCommit } from '@/types';

interface VersionHistoryProps {
  commits: GitHubCommit[];
  loading: boolean;
  onSelectCommit: (sha: string) => void;
  selectedSha: string | null;
  onRestore: (sha: string) => void;
  owner: string;
  repo: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 604800000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function VersionHistory({ commits, loading, onSelectCommit, selectedSha, onRestore, owner, repo }: VersionHistoryProps) {
  const [restoreTarget, setRestoreTarget] = useState<{ sha: string; message: string } | null>(null);

  if (loading) {
    return (
      <div className="p-4 space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="relative flex gap-2.5 rounded-lg p-2.5">
            {i < 4 && (
              <div className="absolute left-[19px] top-10 h-[calc(100%-16px)] w-px bg-border" />
            )}
            <div className="h-6 w-6 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
                <div className="h-4 w-14 rounded-full bg-muted animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="py-12 text-center">
        <History className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No version history</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-4 space-y-1">
          {commits.map((commit, index) => {
            const isSelected = selectedSha === commit.sha;
            return (
              <div
                key={commit.sha}
                role="button"
                tabIndex={0}
                className={`group relative flex w-full gap-2.5 rounded-lg p-2.5 text-left transition-colors cursor-pointer ${
                  isSelected ? 'bg-accent ring-1 ring-primary/30' : 'hover:bg-accent/50'
                }`}
                onClick={() => onSelectCommit(commit.sha)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectCommit(commit.sha); } }}
              >
                {/* Timeline line */}
                {index < commits.length - 1 && (
                  <div className="absolute left-[19px] top-10 h-[calc(100%-16px)] w-px bg-border" />
                )}

                <Avatar className="h-6 w-6 shrink-0 z-10">
                  <AvatarImage src={commit.author.avatar_url} />
                  <AvatarFallback className="text-[10px]">
                    {commit.author.name?.charAt(0) || 'G'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-xs font-medium truncate">{commit.message.split('\n')[0]}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="truncate">{commit.author.login || commit.author.name}</span>
                    <span className="shrink-0">{formatDate(commit.author.date)}</span>
                    <a
                      href={commit.html_url || `https://github.com/${owner}/${repo}/commit/${commit.sha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    >
                      <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 h-4 hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                        {commit.sha.slice(0, 7)}
                      </Badge>
                    </a>
                  </div>
                  {commit.stats && (
                    <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                      <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                        <Plus className="h-2.5 w-2.5" />
                        {commit.stats.additions}
                      </span>
                      <span className="flex items-center gap-0.5 text-red-500">
                        <Minus className="h-2.5 w-2.5" />
                        {commit.stats.deletions}
                      </span>
                    </div>
                  )}
                </div>

                {/* Restore button on hover */}
                <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRestoreTarget({ sha: commit.sha, message: commit.message.split('\n')[0] });
                    }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Restore confirmation dialog */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the file to commit{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                {restoreTarget?.sha.slice(0, 7)}
              </code>{' '}
              ({restoreTarget?.message}). Any unsaved changes in the editor will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (restoreTarget) {
                  onRestore(restoreTarget.sha);
                  setRestoreTarget(null);
                }
              }}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
