'use client';

import { FileText, Command, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeScreenProps {
  owner: string;
  repo: string;
  onOpenFile?: (path: string) => void;
}

export function WelcomeScreen({ owner, repo, onOpenFile }: WelcomeScreenProps) {
  return (
    <div className="flex items-center justify-center h-full" data-testid="welcome-screen">
      <div className="flex flex-col items-center gap-6 max-w-md text-center px-6">
        {/* Icon */}
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-muted">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {owner}/{repo}
          </h1>
          <p className="text-sm text-muted-foreground">
            Select a file from the sidebar to start editing, or use one of the quick actions below.
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            className="w-full sm:w-auto gap-2"
            onClick={() => onOpenFile?.('README.md')}
            data-testid="welcome-open-readme"
            aria-label="Open README.md file for editing"
          >
            <FileText className="h-4 w-4" />
            Open README.md
          </Button>
          <Button
            variant="ghost"
            className="w-full sm:w-auto gap-2 text-muted-foreground"
            disabled
            data-testid="welcome-new-file"
            aria-label="Create a new file (disabled)"
          >
            <FilePlus className="h-4 w-4" />
            New File
          </Button>
        </div>

        {/* Keyboard shortcut hint */}
        <p className="text-xs text-muted-foreground/60">
          Press{' '}
          <kbd className="inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            <Command className="h-2.5 w-2.5" />P
          </kbd>{' '}
          to search files
        </p>
      </div>
    </div>
  );
}
