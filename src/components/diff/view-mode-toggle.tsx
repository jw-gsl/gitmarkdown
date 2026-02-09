'use client';

import { Columns2, Rows2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/ui-store';

export function ViewModeToggle() {
  const diffViewMode = useUIStore((s) => s.diffViewMode);
  const setDiffViewMode = useUIStore((s) => s.setDiffViewMode);

  return (
    <div data-testid="diff-view-mode-toggle" role="radiogroup" aria-label="Diff view mode" className="flex items-center rounded-md border">
      <Button
        variant={diffViewMode === 'split' ? 'secondary' : 'ghost'}
        size="sm"
        role="radio"
        aria-checked={diffViewMode === 'split'}
        aria-label="Side-by-side diff view"
        data-testid="diff-mode-split"
        className="h-6 w-7 p-0 rounded-r-none"
        onClick={() => setDiffViewMode('split')}
        title="Side-by-side"
      >
        <Columns2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant={diffViewMode === 'unified' ? 'secondary' : 'ghost'}
        size="sm"
        role="radio"
        aria-checked={diffViewMode === 'unified'}
        aria-label="Unified diff view"
        data-testid="diff-mode-unified"
        className="h-6 w-7 p-0 rounded-l-none"
        onClick={() => setDiffViewMode('unified')}
        title="Unified"
      >
        <Rows2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
