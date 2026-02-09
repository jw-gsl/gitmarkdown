'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Loader2,
  FileText,
  FilePlus,
  Trash2,
  Pencil,
  ArrowRight,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { diffLines } from 'diff';
import type { PendingFileOp } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSettingsStore } from '@/stores/settings-store';
import { PierreContentDiffView } from '@/components/diff/pierre-diff';

export interface ChangedFileInfo {
  path: string;
  original: string;
  current: string;
}

function countDiffStats(original: string, current: string) {
  const changes = diffLines(original, current);
  let additions = 0;
  let deletions = 0;
  for (const change of changes) {
    const count = change.count ?? 0;
    if (change.added) additions += count;
    if (change.removed) deletions += count;
  }
  return { additions, deletions };
}

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (message: string, description: string) => Promise<void>;
  changedFiles: ChangedFileInfo[];
  pendingOps: PendingFileOp[];
}

export function CommitDialog({
  open,
  onOpenChange,
  onCommit,
  changedFiles,
  pendingOps,
}: CommitDialogProps) {
  const [message, setMessage] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const aiCommitMessages = useSettingsStore((s) => s.aiCommitMessages);
  const totalChanges = changedFiles.length + pendingOps.length;

  // Reset expanded state when dialog closes
  useEffect(() => {
    if (!open) setExpandedFiles(new Set());
  }, [open]);

  // Pre-compute diff stats for all changed files
  const diffStats = useMemo(() => {
    const map = new Map<string, { additions: number; deletions: number }>();
    for (const file of changedFiles) {
      map.set(file.path, countDiffStats(file.original, file.current));
    }
    return map;
  }, [changedFiles]);

  // Auto-generate AI commit message when dialog opens with AI toggle on
  useEffect(() => {
    if (open && aiCommitMessages && changedFiles.length > 0 && !message) {
      handleGenerateAI();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateAI = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changedFiles: changedFiles.map((f) => f.path),
          provider: useSettingsStore.getState().aiProvider,
          modelId: useSettingsStore.getState().aiModel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) setMessage(data.message);
        if (data.description) setDescription(data.description);
      }
    } catch {
      // Silently fail - user can type manually
    } finally {
      setGenerating(false);
    }
  }, [changedFiles]);

  const handleCommit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    try {
      await onCommit(message, description);
      setMessage('');
      setDescription('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="commit-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Commit Changes</DialogTitle>
          <DialogDescription>
            Review and commit {totalChanges} change
            {totalChanges !== 1 ? 's' : ''} to GitHub.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Changed files list */}
          <div className="rounded-md border">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
              <span className="text-xs font-medium text-muted-foreground">
                {totalChanges} change{totalChanges !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="divide-y max-h-[50vh] overflow-y-auto">
              {/* Pending operations */}
              {pendingOps.map((op, i) => (
                <div key={`op-${i}`} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs">
                  {op.type === 'create' && <FilePlus className="h-3 w-3 shrink-0 text-green-500" />}
                  {op.type === 'duplicate' && <FilePlus className="h-3 w-3 shrink-0 text-green-500" />}
                  {op.type === 'delete' && <Trash2 className="h-3 w-3 shrink-0 text-red-500" />}
                  {op.type === 'rename' && <Pencil className="h-3 w-3 shrink-0 text-blue-500" />}
                  {op.type === 'move' && <ArrowRight className="h-3 w-3 shrink-0 text-blue-500" />}
                  <span className="truncate font-mono">
                    {op.type === 'rename' ? `${op.oldPath.split('/').pop()} → ${op.newPath.split('/').pop()}` :
                     op.type === 'move' ? `${op.oldPath} → ${op.newPath.substring(0, op.newPath.lastIndexOf('/'))}` :
                     op.type === 'delete' ? op.path :
                     op.type === 'create' ? op.path :
                     op.newPath}
                  </span>
                  <span className={`ml-auto shrink-0 text-xs font-medium ${
                    op.type === 'create' || op.type === 'duplicate' ? 'text-green-600 dark:text-green-400' :
                    op.type === 'delete' ? 'text-red-600 dark:text-red-400' :
                    'text-blue-600 dark:text-blue-400'
                  }`}>
                    {op.type === 'duplicate' ? 'new' : op.type === 'create' ? 'new' : op.type}
                  </span>
                </div>
              ))}
              {/* Modified files */}
              {changedFiles.map((file) => {
                const stats = diffStats.get(file.path);
                const isExpanded = expandedFiles.has(file.path);
                return (
                  <div key={file.path}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpanded(file.path)}
                    >
                      <ChevronRight className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono text-left">{file.path}</span>
                      <span className="ml-auto shrink-0 flex items-center gap-1.5 text-xs font-medium">
                        {stats && stats.additions > 0 && (
                          <span className="text-green-600 dark:text-green-400">+{stats.additions}</span>
                        )}
                        {stats && stats.deletions > 0 && (
                          <span className="text-red-600 dark:text-red-400">-{stats.deletions}</span>
                        )}
                        {stats && stats.additions === 0 && stats.deletions === 0 && (
                          <span className="text-yellow-600 dark:text-yellow-400">modified</span>
                        )}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="border-t bg-muted/30 px-1 py-1 overflow-x-auto">
                        <PierreContentDiffView
                          oldContent={file.original}
                          newContent={file.current}
                          fileName={file.path}
                          viewMode="unified"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Commit message */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="commit-message">Commit message</Label>
              <Button
                variant="ghost"
                size="sm"
                data-testid="commit-generate-ai"
                aria-label="Generate commit message with AI"
                className="h-6 gap-1 text-xs text-muted-foreground"
                onClick={handleGenerateAI}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Generate with AI
              </Button>
            </div>
            <Input
              id="commit-message"
              data-testid="commit-message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={generating ? 'Generating...' : 'Update documentation'}
              disabled={generating}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="commit-description">Description (optional)</Label>
            <Textarea
              id="commit-description"
              data-testid="commit-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={generating ? 'Generating...' : 'Add a longer description...'}
              rows={2}
              disabled={generating}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" data-testid="commit-cancel" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="commit-submit"
            aria-label="Commit and push changes to GitHub"
            onClick={handleCommit}
            disabled={loading || !message.trim() || generating}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Commit & Push
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
