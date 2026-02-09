'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Wand2, ChevronRight, FileText, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSyncStore } from '@/stores/sync-store';
import { useGitHubCompare, type CompareFile } from '@/hooks/use-github';
import { useAuth } from '@/providers/auth-provider';
import { useSettingsStore } from '@/stores/settings-store';
import { PierrePatchDiffView } from '@/components/diff/pierre-diff';

interface PRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePR: (title: string, body: string, head: string, base: string) => Promise<void>;
  owner: string;
  repo: string;
}

const STATUS_COLORS: Record<string, string> = {
  added: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  removed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  modified: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  renamed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  changed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300',
};

function FileDiffItem({ file }: { file: CompareFile }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors">
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-left flex-1 font-mono text-xs">{file.filename}</span>
        <Badge variant="outline" className={`text-xs px-1.5 py-0 ${STATUS_COLORS[file.status] || ''}`}>
          {file.status}
        </Badge>
        <span className="flex items-center gap-1 text-xs shrink-0">
          {file.additions > 0 && <span className="text-green-600 flex items-center"><Plus className="h-3 w-3" />{file.additions}</span>}
          {file.deletions > 0 && <span className="text-red-600 flex items-center"><Minus className="h-3 w-3" />{file.deletions}</span>}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {file.patch ? (
          <div className="ml-5 mr-2 mb-2 overflow-hidden rounded border">
            <PierrePatchDiffView patch={file.patch} fileName={file.filename} viewMode="unified" />
          </div>
        ) : (
          <p className="ml-8 text-xs text-muted-foreground py-1">Binary file or no diff available</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PRDialog({ open, onOpenChange, onCreatePR, owner, repo }: PRDialogProps) {
  const { currentBranch, branches } = useSyncStore();
  const { user } = useAuth();
  const { aiProvider, userAnthropicKey, userOpenAIKey } = useSettingsStore();
  const { compareData, compareLoading, fetchCompare } = useGitHubCompare();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [base, setBase] = useState('main');
  const [loading, setLoading] = useState(false);
  const [aiTitleLoading, setAiTitleLoading] = useState(false);
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [diffOpen, setDiffOpen] = useState(true);

  // Fetch compare data when dialog opens or base branch changes
  useEffect(() => {
    if (open && owner && repo && base && currentBranch && base !== currentBranch) {
      fetchCompare(owner, repo, base, currentBranch);
    }
  }, [open, owner, repo, base, currentBranch, fetchCompare]);

  const generateAI = useCallback(
    async (field: 'title' | 'description') => {
      if (!compareData || !user) return;
      const setFieldLoading = field === 'title' ? setAiTitleLoading : setAiDescLoading;
      setFieldLoading(true);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/ai/pr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            files: compareData.files,
            commits: compareData.commits,
            field,
            userApiKey: aiProvider === 'anthropic' ? userAnthropicKey || undefined : userOpenAIKey || undefined,
            provider: aiProvider,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (field === 'title' && data.title) setTitle(data.title);
          if (field === 'description' && data.description) setBody(data.description);
        }
      } catch {
        // Silent fallback
      } finally {
        setFieldLoading(false);
      }
    },
    [compareData, user]
  );

  const handleCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onCreatePR(title, body, currentBranch, base);
      setTitle('');
      setBody('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const totalAdditions = compareData?.files.reduce((s, f) => s + f.additions, 0) ?? 0;
  const totalDeletions = compareData?.files.reduce((s, f) => s + f.deletions, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="pr-dialog" className="sm:max-w-2xl h-[min(85vh,640px)] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create Pull Request</DialogTitle>
          <DialogDescription>
            Create a PR from <span className="font-mono text-xs">{currentBranch}</span> into <span className="font-mono text-xs">{base}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Title */}
          <div>
            <div className="flex items-center">
              <Label htmlFor="pr-title">Title</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 ml-auto"
                disabled={aiTitleLoading || !compareData}
                onClick={() => generateAI('title')}
                title="Generate title with AI"
              >
                {aiTitleLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <Input
              id="pr-title"
              data-testid="pr-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add feature documentation"
              className="mt-1.5"
            />
          </div>
          {/* Description */}
          <div>
            <div className="flex items-center">
              <Label htmlFor="pr-body">Description</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 ml-auto"
                disabled={aiDescLoading || !compareData}
                onClick={() => generateAI('description')}
                title="Generate description with AI"
              >
                {aiDescLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <Textarea
              id="pr-body"
              data-testid="pr-body-input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe your changes..."
              className="mt-1.5"
              rows={4}
            />
          </div>
          {/* Base branch */}
          <div>
            <Label htmlFor="pr-base">Base branch</Label>
            <select
              id="pr-base"
              data-testid="pr-base-select"
              aria-label="Select base branch for pull request"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {branches.filter((b) => b !== currentBranch).map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          {/* Diff section */}
          {compareLoading && (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading changes...
            </div>
          )}
          {compareData && compareData.files.length > 0 && (
            <Collapsible open={diffOpen} onOpenChange={setDiffOpen}>
              <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${diffOpen ? 'rotate-90' : ''}`} />
                <span>
                  {compareData.files.length} file{compareData.files.length !== 1 ? 's' : ''} changed
                </span>
                <span className="flex items-center gap-2 ml-auto text-xs">
                  <span className="text-green-600">+{totalAdditions}</span>
                  <span className="text-red-600">-{totalDeletions}</span>
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 max-h-[300px] overflow-y-auto rounded-md border">
                  <div className="divide-y">
                    {compareData.files.map((file) => (
                      <FileDiffItem key={file.filename} file={file} />
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          {compareData && compareData.files.length === 0 && !compareLoading && (
            <p className="text-sm text-muted-foreground text-center py-2">No changes between branches</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" data-testid="pr-cancel" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="pr-submit" aria-label="Create pull request" onClick={handleCreate} disabled={loading || !title.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create PR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
