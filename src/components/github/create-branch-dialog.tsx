'use client';

import { useState, useEffect } from 'react';
import { GitBranch, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const BRANCH_NAME_REGEX = /^[a-zA-Z0-9._/-]+$/;

function validateBranchName(name: string): string | null {
  if (!name.trim()) {
    return 'Branch name is required';
  }
  if (name.startsWith('/') || name.endsWith('/')) {
    return 'Branch name cannot start or end with /';
  }
  if (name.startsWith('.') || name.endsWith('.')) {
    return 'Branch name cannot start or end with .';
  }
  if (name.includes('..')) {
    return 'Branch name cannot contain consecutive dots';
  }
  if (name.includes('//')) {
    return 'Branch name cannot contain consecutive slashes';
  }
  if (!BRANCH_NAME_REGEX.test(name)) {
    return 'Only letters, numbers, hyphens, underscores, dots, and slashes are allowed';
  }
  return null;
}

interface CreateBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateBranch: (name: string) => Promise<void>;
}

export function CreateBranchDialog({
  open,
  onOpenChange,
  onCreateBranch,
}: CreateBranchDialogProps) {
  const { currentBranch } = useSyncStore();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (error) {
      // Clear error on change, revalidate on submit
      setError(null);
    }
  };

  const handleCreate = async () => {
    const validationError = validateBranchName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onCreateBranch(name.trim());
      onOpenChange(false);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to create branch';
      const msg = raw.replace(/\s*-\s*https:\/\/docs\.github\.com\S*/g, '').trim();
      if (msg.includes('Reference already exists')) {
        setError('A branch with this name already exists');
      } else if (msg.includes('Bad credentials')) {
        setError('Your GitHub session has expired. Please sign out and sign back in.');
      } else if (msg.includes('Not Found')) {
        setError('Repository not found. You may not have write access.');
      } else {
        setError(msg || 'Failed to create branch');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="create-branch-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Branch</DialogTitle>
          <DialogDescription>
            Create a new branch from{' '}
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">
              <GitBranch className="h-3 w-3" />
              {currentBranch}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="branch-name">Branch name</Label>
            <Input
              id="branch-name"
              data-testid="branch-name-input"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="feature/my-new-branch"
              autoFocus
              disabled={loading}
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use letters, numbers, hyphens, underscores, dots, or slashes.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            data-testid="create-branch-submit"
            aria-label="Create new branch"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
