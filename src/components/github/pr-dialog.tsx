'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSyncStore } from '@/stores/sync-store';

interface PRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePR: (title: string, body: string, head: string, base: string) => Promise<void>;
}

export function PRDialog({ open, onOpenChange, onCreatePR }: PRDialogProps) {
  const { currentBranch, branches } = useSyncStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [base, setBase] = useState('main');
  const [loading, setLoading] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Pull Request</DialogTitle>
          <DialogDescription>
            Create a PR from {currentBranch} into {base}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="pr-title">Title</Label>
            <Input
              id="pr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add feature documentation"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="pr-body">Description</Label>
            <Textarea
              id="pr-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe your changes..."
              className="mt-1.5"
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="pr-base">Base branch</Label>
            <select
              id="pr-base"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {branches.filter((b) => b !== currentBranch).map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !title.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create PR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
