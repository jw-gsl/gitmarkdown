'use client';

import { Save, ChevronRight, FileText, Eye, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import type { SyncStatus } from '@/types';

interface EditorHeaderProps {
  filePath: string;
  isDirty: boolean;
  syncStatus: SyncStatus;
  isPreview: boolean;
  onSave: () => void;
  onTogglePreview: () => void;
  saving?: boolean;
}

const syncStatusConfig: Record<SyncStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  synced: { label: 'Synced', variant: 'secondary' },
  'local-changes': { label: 'Unsaved', variant: 'outline' },
  'remote-changes': { label: 'Remote changes', variant: 'outline' },
  conflict: { label: 'Conflict', variant: 'destructive' },
  syncing: { label: 'Syncing...', variant: 'secondary' },
  error: { label: 'Sync error', variant: 'destructive' },
};

export function EditorHeader({
  filePath,
  isDirty,
  syncStatus,
  isPreview,
  onSave,
  onTogglePreview,
  saving,
}: EditorHeaderProps) {
  const pathParts = filePath.split('/');
  const config = syncStatusConfig[syncStatus];

  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-1 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground" />
        {pathParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <span className={i === pathParts.length - 1 ? 'font-medium' : 'text-muted-foreground'}>
              {part}
            </span>
          </span>
        ))}
        {isDirty && <span className="ml-2 text-muted-foreground">(modified)</span>}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={config.variant}>{config.label}</Badge>
        <Toggle
          pressed={isPreview}
          onPressedChange={onTogglePreview}
          size="sm"
          className="h-8"
        >
          {isPreview ? <Eye className="mr-1 h-3.5 w-3.5" /> : <Edit className="mr-1 h-3.5 w-3.5" />}
          {isPreview ? 'Preview' : 'Edit'}
        </Toggle>
        <Button size="sm" onClick={onSave} disabled={!isDirty || saving}>
          <Save className="mr-1 h-3.5 w-3.5" />
          Save
        </Button>
      </div>
    </div>
  );
}
