'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { GitBranch, Check, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSyncStore } from '@/stores/sync-store';
import { useFileStore } from '@/stores/file-store';

interface BranchSelectorProps {
  onBranchChange: (branch: string) => void;
  onCreateBranch: () => void;
}

export function BranchSelector({ onBranchChange, onCreateBranch }: BranchSelectorProps) {
  const { currentBranch, branches } = useSyncStore();
  const { dirtyFiles } = useFileStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearch('');
    }
  }, [open]);

  const filteredBranches = useMemo(() => {
    if (!search.trim()) return branches;
    const q = search.toLowerCase();
    return branches.filter((b) => b.toLowerCase().includes(q));
  }, [branches, search]);

  const handleSelect = (branch: string) => {
    if (branch === currentBranch) {
      setOpen(false);
      return;
    }
    if (dirtyFiles.size > 0) {
      const ok = window.confirm(
        `You have ${dirtyFiles.size} unsaved change(s). Switching branches will discard them. Continue?`
      );
      if (!ok) return;
    }
    onBranchChange(branch);
    setOpen(false);
  };

  const handleCreate = () => {
    setOpen(false);
    onCreateBranch();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 text-sm hover:text-muted-foreground transition-colors shrink-0">
          <GitBranch className="h-3.5 w-3.5" />
          <span className="max-w-[100px] sm:max-w-[140px] truncate">{currentBranch}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0" sideOffset={8}>
        {/* Search */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a branch..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Branch list */}
        <div className="max-h-60 overflow-y-auto py-1">
          {filteredBranches.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No branches found
            </div>
          ) : (
            filteredBranches.map((branch) => (
              <button
                key={branch}
                onClick={() => handleSelect(branch)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
              >
                <span className="w-4 shrink-0">
                  {branch === currentBranch && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
                <span className="truncate">{branch}</span>
              </button>
            ))
          )}
        </div>

        {/* Create new branch */}
        <div className="border-t px-1 py-1">
          <button
            onClick={handleCreate}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New branch</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
