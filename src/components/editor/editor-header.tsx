'use client';

import { Check, Loader2 } from 'lucide-react';

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface EditorHeaderProps {
  isDirty: boolean;
  autoSaveStatus: AutoSaveStatus;
}

export function EditorHeader({
  isDirty,
  autoSaveStatus,
}: EditorHeaderProps) {
  // Only show the bar when saving or just saved (errors are shown via toast)
  if (autoSaveStatus === 'idle' || autoSaveStatus === 'error') return null;

  return (
    <div className="flex items-center justify-end border-b px-4 py-1.5 gap-3" data-testid="editor-header">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="save-status" role="status" aria-live="polite" aria-busy={autoSaveStatus === 'saving'}>
        {autoSaveStatus === 'saving' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Saving...</span>
          </>
        )}
        {autoSaveStatus === 'saved' && (
          <>
            <Check className="h-3 w-3 text-green-500" />
            <span className="text-green-600 dark:text-green-400">Auto-saved</span>
          </>
        )}
      </span>
    </div>
  );
}
