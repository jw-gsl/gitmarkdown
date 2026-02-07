'use client';

import { FileText, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  dirtyFiles: string[];
  title?: string;
  description?: string;
  actionLabel?: string;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onDiscard,
  dirtyFiles,
  title = 'Unsaved changes',
  description = 'You have unsaved changes that will be lost. Are you sure you want to continue?',
  actionLabel = 'Discard changes',
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {dirtyFiles.length > 0 && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 max-h-[200px] overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              {dirtyFiles.length} unsaved file{dirtyFiles.length !== 1 ? 's' : ''}:
            </p>
            <ul className="space-y-1">
              {dirtyFiles.map((filePath) => (
                <li key={filePath} className="flex items-center gap-2 text-sm">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono text-xs">{filePath}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
