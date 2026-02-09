'use client';

import { useEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PierreContentDiffView } from '@/components/diff/pierre-diff';
import { cn } from '@/lib/utils';

interface DiffViewProps {
  original: string;
  modified: string;
  onAccept?: () => void;
  onReject?: () => void;
  showActions?: boolean;
  className?: string;
}

export function DiffView({ original, modified, onAccept, onReject, showActions = true, className }: DiffViewProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!showActions) return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          onAccept?.();
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          onReject?.();
        }
      }
    },
    [showActions, onAccept, onReject]
  );

  useEffect(() => {
    if (!showActions) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showActions, handleKeyDown]);

  const removedLines = original.split('\n').length;
  const addedLines = modified.split('\n').length;

  return (
    <div
      data-testid="diff-view"
      className={cn('rounded-lg border overflow-hidden max-w-full', className)}
      role="region"
      aria-label="AI suggested edit"
    >
      {/* Diff stats summary */}
      <div className="flex items-center gap-2 px-2 py-1 border-b bg-muted/30 text-xs text-muted-foreground">
        <span className="font-mono flex items-center gap-1.5" aria-label={`${removedLines} lines removed, ${addedLines} lines added`}>
          <span className="text-red-500 flex items-center gap-0.5"><X className="size-2.5" aria-hidden="true" />{removedLines}</span>
          <span className="text-green-500 flex items-center gap-0.5"><Check className="size-2.5" aria-hidden="true" />{addedLines}</span>
        </span>
        <span className="opacity-60">lines changed</span>
      </div>
      <div className="max-h-96 overflow-auto overflow-x-auto">
        <PierreContentDiffView
          oldContent={original}
          newContent={modified}
          viewMode="unified"
        />
      </div>
      {showActions && (
        <div className="flex justify-end gap-1 border-t px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReject}
            data-testid="diff-reject"
            className="h-6 text-[11px] px-2"
            aria-label="Dismiss edit (Cmd+N)"
          >
            <X className="h-3 w-3 mr-1" />
            Dismiss
            <span className="-ml-0.5 font-normal opacity-60" aria-hidden="true">{'\u2318'}N</span>
          </Button>
          <Button
            size="sm"
            onClick={onAccept}
            data-testid="diff-accept"
            className="h-6 text-[11px] px-2"
            aria-label="Keep edit (Cmd+Y)"
          >
            <Check className="h-3 w-3 mr-1" />
            Keep
            <span className="-ml-0.5 font-normal opacity-60" aria-hidden="true">{'\u2318'}Y</span>
          </Button>
        </div>
      )}
    </div>
  );
}
