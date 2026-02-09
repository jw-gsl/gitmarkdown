'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, Check, X, User, ChevronRight, RotateCcw, AlertTriangle,
  FilePlus, FileCode, ArrowRight, Trash2, Search, Globe, Link, FolderOpen,
  GitCommitHorizontal, GitBranch,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { PierreContentDiffView } from '@/components/diff/pierre-diff';

/** Error boundary to prevent diff rendering errors from crashing the whole chat */
class DiffErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Failed to render diff preview</span>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Shared AI avatar used in both the sidebar and inline edit panel */
export function AIMessageAvatar({ size = 'sm', avatar }: { size?: 'sm' | 'md'; avatar?: string }) {
  const cls = size === 'md' ? 'h-7 w-7' : 'h-6 w-6';
  const textCls = size === 'md' ? 'text-xs' : 'text-xs';
  return (
    <Avatar className={`${cls} shrink-0`}>
      <AvatarFallback className={`bg-primary/10 text-primary ${textCls}`}>{avatar || 'AI'}</AvatarFallback>
    </Avatar>
  );
}

/** Shared user avatar used in both the sidebar and inline edit panel */
export function UserMessageAvatar({ size = 'sm', photoURL }: { size?: 'sm' | 'md'; photoURL?: string | null }) {
  const cls = size === 'md' ? 'h-7 w-7' : 'h-6 w-6';
  const iconCls = size === 'md' ? 'size-3.5' : 'size-3';
  if (photoURL) {
    return (
      <Avatar className={`${cls} shrink-0`}>
        <AvatarImage src={photoURL} />
        <AvatarFallback className="bg-muted">
          <User className={`${iconCls} text-muted-foreground`} />
        </AvatarFallback>
      </Avatar>
    );
  }
  return (
    <div className={`flex ${cls} shrink-0 items-center justify-center rounded-full bg-muted`}>
      <User className={`${iconCls} text-muted-foreground`} />
    </div>
  );
}

/** Shared diff view for editFile tool calls with Undo/Keep actions. */
export function EditToolDiff({
  oldText,
  newText,
  onAccept,
  onReject,
  onRestore,
  status = 'pending',
}: {
  oldText: string;
  newText: string;
  onAccept?: (editedText: string) => void;
  onReject?: () => void;
  onRestore?: () => void;
  status?: 'pending' | 'accepted' | 'rejected';
}) {
  const [editedText] = useState(newText);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard shortcuts: ⌘Y = Keep, ⌘N = Undo
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (status !== 'pending') return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          onAccept?.(editedText);
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          onReject?.();
        }
      }
    },
    [status, onAccept, onReject, editedText]
  );

  useEffect(() => {
    if (status !== 'pending') return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, handleKeyDown]);

  const removedLines = oldText.split('\n').length;
  const addedLines = editedText.split('\n').length;

  // Collapsed summary for accepted/rejected states
  if (status !== 'pending') {
    return (
      <Collapsible>
        <div className="flex items-center gap-1">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 active:scale-[0.99] transition-colors group">
            <ChevronRight className="size-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
            {status === 'accepted' ? (
              <Check className="size-3 text-green-600" aria-hidden="true" />
            ) : (
              <X className="size-3 text-muted-foreground" aria-hidden="true" />
            )}
            <span className={status === 'accepted' ? 'text-green-600' : 'text-muted-foreground'}>
              {status === 'accepted' ? 'Kept' : 'Dismissed'}
            </span>
            <span className="ml-auto flex items-center gap-1.5 font-mono text-xs text-muted-foreground" aria-label={`${removedLines} lines removed, ${addedLines} lines added`}>
              <span className="text-red-500">-{removedLines}</span>
              <span className="text-green-500">+{addedLines}</span>
            </span>
          </CollapsibleTrigger>
          {/* Restore button for rejected edits */}
          {status === 'rejected' && onRestore && (
            <button
              onClick={onRestore}
              className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-all cursor-pointer select-none text-muted-foreground hover:text-foreground hover:bg-accent/50 active:scale-[0.97] h-[22px] min-h-[44px] sm:min-h-0 gap-1 px-1.5 text-xs rounded-[4px]"
              aria-label="Restore rejected edit"
              title="Restore this edit"
            >
              <RotateCcw className="size-3" />
            </button>
          )}
        </div>
        <CollapsibleContent>
          <div className="mt-1.5 rounded-lg border overflow-hidden overflow-x-auto">
            <DiffErrorBoundary>
            <PierreContentDiffView
              oldContent={oldText}
              newContent={editedText}
              viewMode="unified"
            />
            </DiffErrorBoundary>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden overflow-x-auto"
      role="region"
      aria-label="AI suggested edit"
    >
      {/* Diff stats summary */}
      <div className="flex items-center gap-2 px-2 py-1 border-b bg-muted/30 text-xs text-muted-foreground">
        <span className="font-mono flex items-center gap-1.5" aria-label={`${removedLines} lines removed, ${addedLines} lines added`}>
          <span className="text-red-500 flex items-center gap-0.5"><X className="size-2.5" aria-hidden="true" />{removedLines}</span>
          <span className="text-green-500 flex items-center gap-0.5"><Check className="size-2.5" aria-hidden="true" />{addedLines}</span>
        </span>
        <span className="opacity-60">lines changed</span>
      </div>
      <DiffErrorBoundary>
        <PierreContentDiffView
          oldContent={oldText}
          newContent={newText}
          viewMode="unified"
        />
      </DiffErrorBoundary>
      <div className="flex justify-end gap-1 border-t px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReject}
          className="h-6 text-[11px] px-2"
          aria-label="Dismiss edit (Cmd+N)"
        >
          <X className="h-3 w-3 mr-1" />
          Dismiss
          <span className="-ml-0.5 font-normal opacity-60" aria-hidden="true">{'\u2318'}N</span>
        </Button>
        <Button
          ref={nextButtonRef}
          size="sm"
          onClick={() => onAccept?.(editedText)}
          className="h-6 text-[11px] px-2"
          aria-label="Keep edit (Cmd+Y)"
        >
          <Check className="h-3 w-3 mr-1" />
          Keep
          <span className="-ml-0.5 font-normal opacity-60" aria-hidden="true">{'\u2318'}Y</span>
        </Button>
      </div>
    </div>
  );
}

/** Diff view for writeFile tool calls (full file rewrite). */
export function WriteFileDiff({
  currentContent,
  proposedContent,
  onAccept,
  onReject,
  onRestore,
  status = 'pending',
}: {
  currentContent: string;
  proposedContent: string;
  onAccept?: () => void;
  onReject?: () => void;
  onRestore?: () => void;
  status?: 'pending' | 'accepted' | 'rejected';
}) {
  // Keyboard shortcuts: Cmd+Y = Keep, Cmd+N = Dismiss
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (status !== 'pending') return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          onAccept?.();
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          onReject?.();
        }
      }
    },
    [status, onAccept, onReject]
  );

  useEffect(() => {
    if (status !== 'pending') return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, handleKeyDown]);

  const addedLines = proposedContent.split('\n').length;

  if (status !== 'pending') {
    return (
      <Collapsible>
        <div className="flex items-center gap-1">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 active:scale-[0.99] transition-colors group">
            <ChevronRight className="size-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
            {status === 'accepted' ? (
              <Check className="size-3 text-green-600" aria-hidden="true" />
            ) : (
              <X className="size-3 text-muted-foreground" aria-hidden="true" />
            )}
            <FileCode className="size-3" aria-hidden="true" />
            <span className={status === 'accepted' ? 'text-green-600' : 'text-muted-foreground'}>
              {status === 'accepted' ? 'Rewrote file' : 'Rewrite dismissed'}
            </span>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {addedLines} lines
            </span>
          </CollapsibleTrigger>
          {status === 'rejected' && onRestore && (
            <button
              onClick={onRestore}
              className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-all cursor-pointer select-none text-muted-foreground hover:text-foreground hover:bg-accent/50 active:scale-[0.97] h-[22px] min-h-[44px] sm:min-h-0 gap-1 px-1.5 text-xs rounded-[4px]"
              aria-label="Restore rejected rewrite"
              title="Restore this rewrite"
            >
              <RotateCcw className="size-3" />
            </button>
          )}
        </div>
        <CollapsibleContent>
          <div className="mt-1.5 rounded-lg border overflow-hidden overflow-x-auto">
            <DiffErrorBoundary>
              <PierreContentDiffView
                oldContent={currentContent}
                newContent={proposedContent}
                viewMode="unified"
              />
            </DiffErrorBoundary>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden overflow-x-auto" role="region" aria-label="AI suggested file rewrite">
      <div className="flex items-center gap-2 px-2 py-1 border-b bg-muted/30 text-xs text-muted-foreground">
        <FileCode className="size-3" aria-hidden="true" />
        <span>Full file rewrite</span>
        <span className="ml-auto font-mono">{addedLines} lines</span>
      </div>
      <DiffErrorBoundary>
        <PierreContentDiffView
          oldContent={currentContent}
          newContent={proposedContent}
          viewMode="unified"
        />
      </DiffErrorBoundary>
      <div className="flex justify-end gap-1 border-t px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={onReject} className="h-6 text-[11px] px-2" aria-label="Dismiss rewrite (Cmd+N)">
          <X className="h-3 w-3 mr-1" />
          Dismiss
          <span className="-ml-0.5 font-normal opacity-60" aria-hidden="true">{'\u2318'}N</span>
        </Button>
        <Button size="sm" onClick={onAccept} className="h-6 text-[11px] px-2" aria-label="Keep rewrite (Cmd+Y)">
          <Check className="h-3 w-3 mr-1" />
          Keep
          <span className="-ml-0.5 font-normal opacity-60" aria-hidden="true">{'\u2318'}Y</span>
        </Button>
      </div>
    </div>
  );
}

/** Preview for createFile tool calls (new file proposal). */
export function CreateFilePreview({
  filePath,
  content,
  onAccept,
  onReject,
  status = 'pending',
}: {
  filePath: string;
  content: string;
  onAccept?: () => void;
  onReject?: () => void;
  status?: 'pending' | 'accepted' | 'rejected';
}) {
  const fileName = filePath.split('/').pop() ?? filePath;
  const lineCount = content.split('\n').length;

  if (status !== 'pending') {
    return (
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 active:scale-[0.99] transition-colors group">
          <ChevronRight className="size-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
          {status === 'accepted' ? (
            <Check className="size-3 text-green-600" aria-hidden="true" />
          ) : (
            <X className="size-3 text-muted-foreground" aria-hidden="true" />
          )}
          <FilePlus className="size-3" aria-hidden="true" />
          <span className={status === 'accepted' ? 'text-green-600' : 'text-muted-foreground'}>
            {status === 'accepted' ? `Created ${fileName}` : `Dismissed ${fileName}`}
          </span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">{lineCount} lines</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 rounded-lg border overflow-hidden">
            <div className="bg-muted/30 px-2 py-1 border-b text-xs text-muted-foreground font-mono truncate">{filePath}</div>
            <pre className="max-h-60 overflow-auto p-2 text-xs bg-[#f6f8fa] dark:bg-[#161b22] dark:text-[#e6edf3]"><code>{content}</code></pre>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden" role="region" aria-label={`Create new file: ${filePath}`}>
      <div className="flex items-center gap-2 px-2 py-1 border-b bg-muted/30 text-xs text-muted-foreground">
        <FilePlus className="size-3" aria-hidden="true" />
        <span className="font-mono truncate">{filePath}</span>
        <span className="ml-auto shrink-0">{lineCount} lines</span>
      </div>
      <pre className="max-h-60 overflow-auto p-2 text-xs bg-[#f6f8fa] dark:bg-[#161b22] dark:text-[#e6edf3]"><code>{content}</code></pre>
      <div className="flex justify-end gap-1 border-t px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={onReject} className="h-6 text-[11px] px-2" aria-label="Dismiss new file">
          <X className="h-3 w-3 mr-1" />
          Dismiss
        </Button>
        <Button size="sm" onClick={onAccept} className="h-6 text-[11px] px-2" aria-label="Create file">
          <Check className="h-3 w-3 mr-1" />
          Create
        </Button>
      </div>
    </div>
  );
}

/** Preview for renameFile tool calls. */
export function RenameFilePreview({
  oldPath,
  newPath,
  onAccept,
  onReject,
  status = 'pending',
}: {
  oldPath: string;
  newPath: string;
  onAccept?: () => void;
  onReject?: () => void;
  status?: 'pending' | 'accepted' | 'rejected';
}) {
  const oldName = oldPath.split('/').pop() ?? oldPath;
  const newName = newPath.split('/').pop() ?? newPath;

  if (status !== 'pending') {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
        {status === 'accepted' ? (
          <Check className="size-3 text-green-600" />
        ) : (
          <X className="size-3 text-muted-foreground" />
        )}
        <ArrowRight className="size-3" />
        <span className={status === 'accepted' ? 'text-green-600' : 'text-muted-foreground line-through'}>
          {oldName} → {newName}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden" role="region" aria-label={`Rename ${oldPath} to ${newPath}`}>
      <div className="flex items-center gap-2 px-2 py-1.5 border-b bg-muted/30 text-xs text-muted-foreground">
        <ArrowRight className="size-3" />
        <span className="font-mono">{oldPath}</span>
        <span>→</span>
        <span className="font-mono font-medium text-foreground">{newPath}</span>
      </div>
      <div className="flex justify-end gap-1 px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={onReject} className="h-6 text-[11px] px-2">
          <X className="h-3 w-3 mr-1" />Dismiss
        </Button>
        <Button size="sm" onClick={onAccept} className="h-6 text-[11px] px-2">
          <Check className="h-3 w-3 mr-1" />Rename
        </Button>
      </div>
    </div>
  );
}

/** Preview for deleteFile tool calls. */
export function DeleteFilePreview({
  filePath,
  onAccept,
  onReject,
  status = 'pending',
}: {
  filePath: string;
  onAccept?: () => void;
  onReject?: () => void;
  status?: 'pending' | 'accepted' | 'rejected';
}) {
  const fileName = filePath.split('/').pop() ?? filePath;

  if (status !== 'pending') {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
        {status === 'accepted' ? (
          <Check className="size-3 text-green-600" />
        ) : (
          <X className="size-3 text-muted-foreground" />
        )}
        <Trash2 className="size-3" />
        <span className={status === 'accepted' ? 'text-red-500 line-through' : 'text-muted-foreground'}>
          {status === 'accepted' ? `Deleted ${fileName}` : `Kept ${fileName}`}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 dark:border-red-900/50 overflow-hidden" role="region" aria-label={`Delete ${filePath}`}>
      <div className="flex items-center gap-2 px-2 py-1.5 border-b bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-400">
        <Trash2 className="size-3" />
        <span className="font-mono">{filePath}</span>
      </div>
      <div className="flex justify-end gap-1 px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={onReject} className="h-6 text-[11px] px-2">
          <X className="h-3 w-3 mr-1" />Keep
        </Button>
        <Button variant="destructive" size="sm" onClick={onAccept} className="h-6 text-[11px] px-2">
          <Trash2 className="h-3 w-3 mr-1" />Delete
        </Button>
      </div>
    </div>
  );
}

/** Quick-reply suggestion buttons from suggestResponses tool. */
export function SuggestResponsesView({
  suggestions,
  onSelect,
}: {
  suggestions: string[];
  onSelect: (text: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-accent transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/** Collapsible display for server-side tool results (readFile, searchFiles, etc). */
export function ToolResultDisplay({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 active:scale-[0.99] transition-colors group">
        <ChevronRight className="size-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        {icon}
        <span className="text-muted-foreground">{label}</span>
      </CollapsibleTrigger>
      {children && (
        <CollapsibleContent>
          <div className="mt-1 rounded-lg border overflow-hidden max-h-48 overflow-y-auto">
            {children}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

/** Preview for commitChanges tool calls. */
export function CommitProposal({
  message,
  description,
  onAccept,
  onReject,
  status = 'pending',
}: {
  message: string;
  description?: string;
  onAccept?: () => void;
  onReject?: () => void;
  status?: 'pending' | 'accepted' | 'rejected';
}) {
  if (status !== 'pending') {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
        {status === 'accepted' ? (
          <Check className="size-3 text-green-600" />
        ) : (
          <X className="size-3 text-muted-foreground" />
        )}
        <GitCommitHorizontal className="size-3" />
        <span className={status === 'accepted' ? 'text-green-600' : 'text-muted-foreground'}>
          {status === 'accepted' ? 'Commit ready' : 'Commit dismissed'}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden" role="region" aria-label="Commit proposal">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b bg-muted/30 text-xs text-muted-foreground">
        <GitCommitHorizontal className="size-3" />
        <span>Commit proposal</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-medium">{message}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex justify-end gap-1 border-t px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={onReject} className="h-6 text-[11px] px-2">
          <X className="h-3 w-3 mr-1" />Dismiss
        </Button>
        <Button size="sm" onClick={onAccept} className="h-6 text-[11px] px-2">
          <GitCommitHorizontal className="h-3 w-3 mr-1" />Open Commit Dialog
        </Button>
      </div>
    </div>
  );
}

/** Preview for createBranch tool calls. */
export function CreateBranchProposal({
  branchName,
  sourceBranch,
  onAccept,
  onReject,
  status = 'pending',
}: {
  branchName: string;
  sourceBranch?: string;
  onAccept?: () => void;
  onReject?: () => void;
  status?: 'pending' | 'accepted' | 'rejected';
}) {
  if (status !== 'pending') {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
        {status === 'accepted' ? (
          <Check className="size-3 text-green-600" />
        ) : (
          <X className="size-3 text-muted-foreground" />
        )}
        <GitBranch className="size-3" />
        <span className={status === 'accepted' ? 'text-green-600' : 'text-muted-foreground'}>
          {status === 'accepted' ? `Branch "${branchName}" ready` : 'Branch dismissed'}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden" role="region" aria-label="Create branch proposal">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b bg-muted/30 text-xs text-muted-foreground">
        <GitBranch className="size-3" />
        <span>Create branch</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-mono font-medium">{branchName}</p>
        {sourceBranch && <p className="mt-1 text-xs text-muted-foreground">from {sourceBranch}</p>}
      </div>
      <div className="flex justify-end gap-1 border-t px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={onReject} className="h-6 text-[11px] px-2">
          <X className="h-3 w-3 mr-1" />Dismiss
        </Button>
        <Button size="sm" onClick={onAccept} className="h-6 text-[11px] px-2">
          <GitBranch className="h-3 w-3 mr-1" />Create Branch
        </Button>
      </div>
    </div>
  );
}

/** Streaming indicator */
export function StreamingIndicator({ label = 'Thinking...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-1" role="status" aria-live="polite">
      <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
