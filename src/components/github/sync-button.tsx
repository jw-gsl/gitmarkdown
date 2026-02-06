'use client';

import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  GitPullRequest,
  GitBranch,
  Loader2,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useSyncStore } from '@/stores/sync-store';
import { useFileStore } from '@/stores/file-store';
import type { SyncStatus } from '@/types';

interface SyncButtonProps {
  onPull: () => Promise<void>;
  onPush: () => Promise<void>;
  onCreatePR: () => void;
  onCreateBranch?: () => void;
}

const statusIcons: Record<SyncStatus, React.ReactNode> = {
  synced: <Check className="h-3.5 w-3.5 text-green-500" />,
  'local-changes': <ArrowUpFromLine className="h-3.5 w-3.5 text-yellow-500" />,
  'remote-changes': <ArrowDownToLine className="h-3.5 w-3.5 text-blue-500" />,
  conflict: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
  syncing: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
};

export function SyncButton({ onPull, onPush, onCreatePR, onCreateBranch }: SyncButtonProps) {
  const { syncStatus, isSyncing, currentBranch } = useSyncStore();
  const { dirtyFiles } = useFileStore();
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);

  const handlePull = async () => {
    setPulling(true);
    try { await onPull(); } finally { setPulling(false); }
  };

  const handlePush = async () => {
    setPushing(true);
    try { await onPush(); } finally { setPushing(false); }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={isSyncing}>
          {statusIcons[syncStatus]}
          <span className="text-xs">
            {syncStatus === 'synced' ? 'Synced' : syncStatus === 'local-changes' ? `${dirtyFiles.size} changes` : syncStatus}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Branch: <span className="font-medium text-foreground">{currentBranch}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handlePull} disabled={pulling}>
          {pulling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
          Pull from GitHub
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePush} disabled={pushing || dirtyFiles.size === 0}>
          {pushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="mr-2 h-4 w-4" />}
          Push to {currentBranch}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {onCreateBranch && (
          <DropdownMenuItem onClick={onCreateBranch}>
            <GitBranch className="mr-2 h-4 w-4" />
            Create new branch
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onCreatePR}>
          <GitPullRequest className="mr-2 h-4 w-4" />
          Create Pull Request
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
