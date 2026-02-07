'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, Check, X, User, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

/** Shared AI avatar used in both the sidebar and inline edit panel */
export function AIMessageAvatar({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-7 w-7' : 'h-6 w-6';
  const textCls = size === 'md' ? 'text-xs' : 'text-[10px]';
  return (
    <Avatar className={`${cls} shrink-0`}>
      <AvatarFallback className={`bg-primary/10 text-primary ${textCls}`}>AI</AvatarFallback>
    </Avatar>
  );
}

/** Shared user avatar used in both the sidebar and inline edit panel */
export function UserMessageAvatar({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-7 w-7' : 'h-6 w-6';
  const iconCls = size === 'md' ? 'size-3.5' : 'size-3';
  return (
    <div className={`flex ${cls} shrink-0 items-center justify-center rounded-full bg-muted`}>
      <User className={`${iconCls} text-muted-foreground`} />
    </div>
  );
}

/** Shared diff view for editFile tool calls with Accept/Reject actions.
 *  The "new text" section is editable so the user can tweak AI suggestions before accepting.
 */
export function EditToolDiff({
  oldText,
  newText,
  onAccept,
  onReject,
  status = 'pending',
}: {
  oldText: string;
  newText: string;
  onAccept?: (editedText: string) => void;
  onReject?: () => void;
  status?: 'pending' | 'accepted' | 'rejected';
}) {
  const [editedText, setEditedText] = useState(newText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when newText changes (e.g. streaming finishes)
  useEffect(() => {
    setEditedText(newText);
  }, [newText]);

  const isEdited = editedText !== newText;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editedText]);

  const removedLines = oldText.split('\n').length;
  const addedLines = editedText.split('\n').length;

  // Collapsed summary for accepted/rejected states
  if (status !== 'pending') {
    return (
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors group">
          <ChevronRight className="size-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
          {status === 'accepted' ? (
            <Check className="size-3 text-green-600" />
          ) : (
            <X className="size-3 text-muted-foreground" />
          )}
          <span className={status === 'accepted' ? 'text-green-600' : 'text-muted-foreground'}>
            {status === 'accepted' ? 'Applied' : 'Rejected'}
          </span>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="text-red-500">-{removedLines}</span>
            <span className="text-green-500">+{addedLines}</span>
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 rounded-lg border overflow-hidden">
            <div className="bg-red-50 dark:bg-red-950/30 px-3 py-2 border-b border-red-200/50 dark:border-red-900/30">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words overflow-hidden text-red-700 dark:text-red-400">{oldText}</pre>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 px-3 py-2">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words overflow-hidden text-green-700 dark:text-green-400">{editedText}</pre>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border overflow-hidden">
        {/* Original text - red, read-only */}
        <div className="bg-red-50 dark:bg-red-950/30 px-3 py-2 border-b border-red-200/50 dark:border-red-900/30">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono text-red-500/70 select-none leading-none">
              {removedLines}
            </span>
            <span className="text-[10px] font-mono text-red-500 select-none leading-none">-</span>
          </div>
          <pre className="text-xs font-mono whitespace-pre-wrap break-words overflow-hidden text-red-700 dark:text-red-400">{oldText}</pre>
        </div>
        {/* New text - green, editable */}
        <div className="bg-green-50 dark:bg-green-950/30 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono text-green-500/70 select-none leading-none">
              {addedLines}
            </span>
            <span className="text-[10px] font-mono text-green-500 select-none leading-none">+</span>
            {isEdited && (
              <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">(edited)</span>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full bg-transparent text-xs font-mono resize-none outline-none text-green-700 dark:text-green-400 min-h-[1.5em] focus:ring-1 focus:ring-green-400/30 rounded px-1 -mx-1"
            rows={1}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onReject}
        >
          <X className="mr-1 size-3" />
          Reject
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
          onClick={() => onAccept?.(editedText)}
        >
          <Check className="mr-1 size-3" />
          Accept
        </Button>
      </div>
    </div>
  );
}

/** Streaming indicator */
export function StreamingIndicator({ label = 'Thinking...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
