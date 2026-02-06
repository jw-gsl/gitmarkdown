'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useSettingsStore } from '@/stores/settings-store';

interface FileChange {
  path: string;
  additions: number;
  deletions: number;
}

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (message: string, description: string) => Promise<void>;
  changedFiles: string[];
}

export function CommitDialog({
  open,
  onOpenChange,
  onCommit,
  changedFiles,
}: CommitDialogProps) {
  const [message, setMessage] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const aiCommitMessages = useSettingsStore((s) => s.aiCommitMessages);

  // Build file changes with simulated diff stats
  const fileChanges: FileChange[] = changedFiles.map((f) => ({
    path: f,
    additions: Math.floor(Math.random() * 10) + 1,
    deletions: Math.floor(Math.random() * 5),
  }));

  const totalAdditions = fileChanges.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = fileChanges.reduce((s, f) => s + f.deletions, 0);

  // Auto-generate AI commit message when dialog opens with AI toggle on
  useEffect(() => {
    if (open && aiCommitMessages && changedFiles.length > 0 && !message) {
      handleGenerateAI();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFile = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleGenerateAI = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Generate a concise git commit message (title on first line, then blank line, then 1-2 sentence description) for changes to these files: ${changedFiles.join(', ')}. Only output the commit message, nothing else.`,
            },
          ],
          provider: useSettingsStore.getState().aiProvider,
          modelId: useSettingsStore.getState().aiModel,
        }),
      });

      if (res.ok) {
        const text = await res.text();
        // Parse the streaming response - extract text content
        const lines = text.split('\n').filter(Boolean);
        let fullText = '';
        for (const line of lines) {
          // AI SDK streams data as formatted events
          if (line.startsWith('0:')) {
            try {
              fullText += JSON.parse(line.slice(2));
            } catch {
              // skip unparseable lines
            }
          }
        }
        if (fullText) {
          const parts = fullText.split('\n\n');
          setMessage(parts[0]?.trim() || '');
          setDescription(parts.slice(1).join('\n\n').trim());
        }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Commit Changes</DialogTitle>
          <DialogDescription>
            Review and commit {changedFiles.length} file
            {changedFiles.length !== 1 ? 's' : ''} to GitHub.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Changed files with diff summary */}
          <div className="rounded-md border">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
              <span className="text-xs font-medium text-muted-foreground">
                {changedFiles.length} file{changedFiles.length !== 1 ? 's' : ''} changed
              </span>
              <span className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                  <Plus className="h-3 w-3" />
                  {totalAdditions}
                </span>
                <span className="flex items-center gap-0.5 text-red-500">
                  <Minus className="h-3 w-3" />
                  {totalDeletions}
                </span>
              </span>
            </div>
            <div className="divide-y max-h-40 overflow-y-auto">
              {fileChanges.map((file) => (
                <Collapsible
                  key={file.path}
                  open={expandedFiles.has(file.path)}
                  onOpenChange={() => toggleFile(file.path)}
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent/50 transition-colors">
                    {expandedFiles.has(file.path) ? (
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono">{file.path}</span>
                    <span className="ml-auto flex items-center gap-1.5 shrink-0">
                      <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
                      <span className="text-red-500">-{file.deletions}</span>
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mx-3 mb-2 rounded bg-muted/30 p-2 text-[11px] font-mono">
                      <div className="text-green-600 dark:text-green-400">
                        + Modified content
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
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
                className="h-6 gap-1 text-[10px] text-muted-foreground"
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={generating ? 'Generating...' : 'Add a longer description...'}
              rows={2}
              disabled={generating}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
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
