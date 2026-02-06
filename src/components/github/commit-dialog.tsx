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

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (message: string, description: string) => Promise<void>;
  changedFiles: string[];
}

export function CommitDialog({ open, onOpenChange, onCommit, changedFiles }: CommitDialogProps) {
  const [message, setMessage] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commit Changes</DialogTitle>
          <DialogDescription>
            Push {changedFiles.length} file{changedFiles.length !== 1 ? 's' : ''} to GitHub.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="commit-message">Commit message</Label>
            <Input
              id="commit-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Update documentation"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="commit-description">Description (optional)</Label>
            <Textarea
              id="commit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a longer description of your changes..."
              className="mt-1.5"
              rows={3}
            />
          </div>
          <div className="rounded border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Changed files:</p>
            <div className="space-y-1">
              {changedFiles.map((file) => (
                <p key={file} className="text-xs font-mono text-muted-foreground">{file}</p>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCommit} disabled={loading || !message.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Commit & Push
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
