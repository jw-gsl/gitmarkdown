'use client';

import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  GitPullRequest,
  GitBranch,
  Loader2,
  ChevronDown,
  AlertCircle,
  Check,
  Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSyncStore } from '@/stores/sync-store';
import { useFileStore } from '@/stores/file-store';
import { useSettingsStore } from '@/stores/settings-store';

interface SyncButtonProps {
  onPull: () => Promise<void>;
  onPush: () => Promise<void>;
  onCreatePR: () => void;
  onCreateBranch?: () => void;
  onOpenAutoSaveSettings?: () => void;
}

type EffectiveStatus = 'synced' | 'local-changes' | 'syncing' | 'error' | 'auto-commit-off';

function useEffectiveStatus(): { status: EffectiveStatus; label: string; dirtyCount: number } {
  const { syncStatus: manualSyncStatus, isSyncing } = useSyncStore();
  const { dirtyFiles } = useFileStore();
  const { autoCommitDelay } = useSettingsStore();

  const dirtyCount = dirtyFiles.size;

  if (isSyncing || manualSyncStatus === 'syncing') {
    return { status: 'syncing', label: 'Syncing', dirtyCount };
  }

  if (manualSyncStatus === 'error') {
    return { status: 'error', label: 'Failed', dirtyCount };
  }

  if (dirtyCount > 0) {
    if (autoCommitDelay <= 0) {
      return { status: 'auto-commit-off', label: `${dirtyCount} unsaved`, dirtyCount };
    }
    return { status: 'local-changes', label: 'Sync', dirtyCount };
  }

  return { status: 'synced', label: 'Synced', dirtyCount };
}

const statusStyles: Record<EffectiveStatus, { icon: React.ReactNode; buttonClass: string }> = {
  synced: {
    icon: <Check className="h-3.5 w-3.5" />,
    buttonClass: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50',
  },
  'local-changes': {
    icon: <Circle className="h-2.5 w-2.5 fill-current" />,
    buttonClass: 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-400 dark:hover:bg-yellow-950/50',
  },
  syncing: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    buttonClass: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50',
  },
  error: {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    buttonClass: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50',
  },
  'auto-commit-off': {
    icon: <Circle className="h-2 w-2 fill-current" />,
    buttonClass: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400 dark:hover:bg-orange-950/50',
  },
};

export function SyncButton({ onPull, onPush, onCreatePR, onCreateBranch, onOpenAutoSaveSettings }: SyncButtonProps) {
  const { isSyncing, currentBranch, syncError } = useSyncStore();
  const { dirtyFiles } = useFileStore();
  const { autoCommitDelay } = useSettingsStore();
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);

  const { status, label, dirtyCount } = useEffectiveStatus();
  const styles = statusStyles[status];

  const handlePull = async () => {
    setPulling(true);
    try { await onPull(); } finally { setPulling(false); }
  };

  const handlePush = async () => {
    setPushing(true);
    try { await onPush(); } finally { setPushing(false); }
  };

  const tooltipText = (() => {
    switch (status) {
      case 'synced': return 'All changes saved to GitHub';
      case 'local-changes': return `${dirtyCount} file${dirtyCount !== 1 ? 's' : ''} modified — will auto-save in ${autoCommitDelay}s`;
      case 'syncing': return 'Saving to GitHub...';
      case 'error': return syncError || 'Sync failed — try pushing manually';
      case 'auto-commit-off': return `${dirtyCount} unsaved file${dirtyCount !== 1 ? 's' : ''} — auto-commit is off`;
    }
  })();

  return (
    <DropdownMenu>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid="sync-button"
                aria-label={`Sync: ${label}`}
                aria-busy={status === 'syncing'}
                className={`h-8 gap-1.5 transition-colors ${styles.buttonClass}`}
                disabled={isSyncing}
              >
                {styles.icon}
                <span className="text-xs font-medium">{label}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">
              {tooltipText}
              {status === 'auto-commit-off' && onOpenAutoSaveSettings && (
                <>
                  {' — '}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAutoSaveSettings();
                    }}
                    className="underline underline-offset-2 hover:opacity-70 transition-opacity cursor-pointer"
                  >
                    Turn on
                  </button>
                </>
              )}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Branch: <span className="font-medium text-foreground">{currentBranch}</span>
        </div>
        {status === 'error' && syncError && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-red-500">{syncError}</div>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="sync-pull" aria-label="Pull latest changes from GitHub" onClick={handlePull} disabled={pulling}>
          {pulling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
          Pull from GitHub
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="sync-push" aria-label={`Push changes to ${currentBranch}`} onClick={handlePush} disabled={pushing || dirtyFiles.size === 0}>
          {pushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="mr-2 h-4 w-4" />}
          Push to {currentBranch}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {onCreateBranch && (
          <DropdownMenuItem data-testid="sync-create-branch" aria-label="Create a new branch" onClick={onCreateBranch}>
            <GitBranch className="mr-2 h-4 w-4" />
            Create new branch
          </DropdownMenuItem>
        )}
        <DropdownMenuItem data-testid="sync-create-pr" aria-label="Create a new pull request" onClick={onCreatePR}>
          <GitPullRequest className="mr-2 h-4 w-4" />
          Create Pull Request
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
