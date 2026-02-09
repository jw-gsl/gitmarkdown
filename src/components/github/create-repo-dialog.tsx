'use client';

import { useState, useEffect } from 'react';
import { Loader2, Lock, Globe } from 'lucide-react';
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

const REPO_NAME_REGEX = /^[a-zA-Z0-9._-]+$/;

/** Replace characters GitHub auto-sanitizes (spaces → hyphens) */
function sanitizeRepoName(raw: string): string {
  return raw.replace(/\s+/g, '-');
}

function validateRepoName(name: string): string | null {
  if (!name.trim()) {
    return 'Repository name is required';
  }
  if (name.startsWith('.') || name.startsWith('-')) {
    return 'Name cannot start with a dot or hyphen';
  }
  if (name.endsWith('.git') || name.endsWith('.lock')) {
    return 'Name cannot end with .git or .lock';
  }
  if (name === '.' || name === '..') {
    return 'Name cannot be "." or ".."';
  }
  if (!REPO_NAME_REGEX.test(name)) {
    return 'Only letters, numbers, hyphens, underscores, and dots are allowed';
  }
  if (name.length > 100) {
    return 'Name must be 100 characters or fewer';
  }
  return null;
}

/** Map raw GitHub/Octokit errors to user-friendly messages */
function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Failed to create repository';
  // Strip trailing GitHub doc URLs that Octokit appends
  const msg = raw.replace(/\s*-\s*https:\/\/docs\.github\.com\S*/g, '').trim();

  if (msg.includes('name already exists'))
    return 'A repository with this name already exists on your account';
  if (msg.includes('Bad credentials'))
    return 'Your GitHub session has expired. Please sign out and sign back in.';
  if (msg.includes('Not authenticated') || msg.includes('No GitHub token'))
    return 'Not connected to GitHub. Please sign out and sign back in.';
  if (msg.includes('Resource not accessible'))
    return 'Your GitHub token doesn\'t have permission to create repositories. Please reconnect your account.';
  if (msg.includes('rate limit'))
    return 'GitHub rate limit reached. Please wait a moment and try again.';
  if (msg.includes('Repository creation failed'))
    return 'GitHub couldn\'t create the repository. Please try a different name.';
  if (msg.includes('Validation Failed'))
    return 'Invalid repository name or settings. Please try a different name.';

  return msg || 'Failed to create repository';
}

interface CreateRepoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateRepo: (name: string, options: { description?: string; isPrivate?: boolean; autoInit?: boolean }) => Promise<{ full_name: string }>;
}

export function CreateRepoDialog({
  open,
  onOpenChange,
  onCreateRepo,
}: CreateRepoDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setIsPrivate(true);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleNameChange = (value: string) => {
    setName(sanitizeRepoName(value));
    if (error) setError(null);
  };

  const handleCreate = async () => {
    const validationError = validateRepoName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onCreateRepo(name.trim(), {
        description: description.trim() || undefined,
        isPrivate,
        autoInit: true,
      });
      onOpenChange(false);
    } catch (err) {
      setError(friendlyError(err));
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
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent
        data-testid="create-repo-dialog"
        className="sm:max-w-md"
        onPointerDownOutside={(e) => { if (loading) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (loading) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Create New Repository</DialogTitle>
          <DialogDescription>
            A new GitHub repository will be created under your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repo-name">Repository name</Label>
            <Input
              id="repo-name"
              data-testid="repo-name-input"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="my-new-repo"
              autoFocus
              disabled={loading}
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="repo-description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="repo-description"
              data-testid="repo-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="A short description of the repository"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                disabled={loading}
                className={`flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  !isPrivate
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <Globe className="h-4 w-4" />
                Public
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                disabled={loading}
                className={`flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  isPrivate
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <Lock className="h-4 w-4" />
                Private
              </button>
            </div>
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
            data-testid="create-repo-submit"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Repository
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
