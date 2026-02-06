'use client';

import { useState, useEffect } from 'react';
import { History, GitCommit, ChevronRight, RotateCcw, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { GitHubCommit } from '@/types';

interface VersionHistoryProps {
  commits: GitHubCommit[];
  loading: boolean;
  onViewDiff: (sha: string) => void;
  onRestore: (sha: string) => void;
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

export function VersionHistory({ commits, loading, onViewDiff, onRestore }: VersionHistoryProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
    <ScrollArea className="h-full">
      <div className="p-4 space-y-1">
        {commits.map((commit, index) => (
          <div
            key={commit.sha}
            className="group relative flex gap-3 rounded-lg p-3 transition-colors hover:bg-accent/50"
          >
            {/* Timeline line */}
            {index < commits.length - 1 && (
              <div className="absolute left-[23px] top-12 h-[calc(100%-24px)] w-px bg-border" />
            )}

            <Avatar className="h-7 w-7 shrink-0 z-10">
              <AvatarImage src={commit.author.avatar_url} />
              <AvatarFallback className="text-xs">
                {commit.author.name?.charAt(0) || 'G'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{commit.message.split('\n')[0]}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{commit.author.login || commit.author.name}</span>
                <span>{formatDate(commit.author.date)}</span>
                <Badge variant="outline" className="text-xs font-mono px-1">
                  {commit.sha.slice(0, 7)}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => onViewDiff(commit.sha)}
                >
                  <ChevronRight className="mr-1 h-3 w-3" />
                  View diff
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => onRestore(commit.sha)}
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Restore
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
