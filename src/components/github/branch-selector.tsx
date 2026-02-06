'use client';

import { GitBranch, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSyncStore } from '@/stores/sync-store';

interface BranchSelectorProps {
  onBranchChange: (branch: string) => void;
  onCreateBranch: () => void;
}

export function BranchSelector({ onBranchChange, onCreateBranch }: BranchSelectorProps) {
  const { currentBranch, branches } = useSyncStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <GitBranch className="h-3.5 w-3.5" />
          {currentBranch}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {branches.map((branch) => (
          <DropdownMenuItem key={branch} onClick={() => onBranchChange(branch)}>
            {branch === currentBranch && <Check className="mr-2 h-4 w-4" />}
            <span className={branch !== currentBranch ? 'ml-6' : ''}>{branch}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateBranch}>
          <Plus className="mr-2 h-4 w-4" />
          New branch
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
