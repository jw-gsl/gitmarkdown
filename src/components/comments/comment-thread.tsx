'use client';

import { useState, useRef, useCallback } from 'react';
import { Check, Smile, Send, MoreVertical, Pencil, Trash2, Link2, RotateCcw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { MentionDropdown, type MentionUser } from './mention-dropdown';
import type { Comment } from '@/types';

/** GitHub-supported reactions — the only ones we show in the picker */
const GITHUB_REACTIONS = [
  { emoji: '\uD83D\uDC4D', label: 'thumbs up' },    // 👍
  { emoji: '\uD83D\uDC4E', label: 'thumbs down' },   // 👎
  { emoji: '\uD83D\uDE04', label: 'laugh' },          // 😄
  { emoji: '\uD83C\uDF89', label: 'hooray' },         // 🎉
  { emoji: '\uD83D\uDE15', label: 'confused' },       // 😕
  { emoji: '\u2764\uFE0F', label: 'heart' },          // ❤️
  { emoji: '\uD83D\uDE80', label: 'rocket' },         // 🚀
  { emoji: '\uD83D\uDC40', label: 'eyes' },           // 👀
];

interface CommentThreadProps {
  comment: Comment;
  replies: Comment[];
  onReply: (content: string) => void;
  onResolve: () => void;
  onReopen?: () => void;
  onReaction: (commentId: string, emoji: string) => void;
  onEdit?: (commentId: string, newContent: string) => void;
  onDelete?: (commentId: string) => void;
  isResolved?: boolean;
  isActive?: boolean;
  onSelect?: () => void;
  mentionUsers?: MentionUser[];
}

function formatTime(date: Date | { seconds: number }): string {
  const d = date instanceof Date ? date : new Date((date as { seconds: number }).seconds * 1000);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function CommentMessage({ comment, onReaction }: { comment: Comment; onReaction?: (commentId: string, emoji: string) => void }) {
  const [emojiOpen, setEmojiOpen] = useState(false);

  return (
    <div className="group/msg flex gap-2.5">
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={comment.author.photoURL || ''} />
        <AvatarFallback className="text-xs">
          {comment.author.displayName.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col">
          <span className="text-xs font-medium">{comment.author.displayName}</span>
          <span className="text-[11px] text-muted-foreground leading-tight">
            {formatTime(comment.createdAt)}
          </span>
        </div>
        <div className="relative">
          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
          {/* Emoji reaction icon on hover */}
          {onReaction && (
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -right-1 top-0 h-5 w-5 opacity-0 transition-opacity group-hover/msg:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                  title="Add reaction"
                >
                  <Smile className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-1.5"
                align="end"
                side="bottom"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex gap-0.5">
                  {GITHUB_REACTIONS.map(({ emoji, label }) => (
                    <button
                      key={label}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-base transition-colors"
                      title={label}
                      onClick={() => {
                        onReaction(comment.id, emoji);
                        setEmojiOpen(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        {comment.type === 'suggestion' && comment.suggestion && (
          <div className="mt-2 rounded border text-xs overflow-hidden">
            <div className="bg-red-50 dark:bg-red-950/30 px-2 py-1 line-through text-red-700 dark:text-red-400">
              {comment.suggestion.originalText}
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 px-2 py-1 text-green-700 dark:text-green-400">
              {comment.suggestion.suggestedText}
            </div>
          </div>
        )}
        {Object.entries(comment.reactions).filter(([, users]) => users.length > 0).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Object.entries(comment.reactions)
              .filter(([, users]) => users.length > 0)
              .map(([emoji, users]) => (
              <button
                key={emoji}
                className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  onReaction?.(comment.id, emoji);
                }}
              >
                {emoji} <span>{users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InlineReplyInput({
  onSubmit,
  mentionUsers = [],
}: {
  onSubmit: (content: string) => void;
  mentionUsers?: MentionUser[];
}) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mention state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);

  const showActions = isFocused || content.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (!content.trim()) return;
    onSubmit(content.trim());
    setContent('');
    setIsFocused(false);
    setMentionOpen(false);
    textareaRef.current?.blur();
  }, [content, onSubmit]);

  const handleCancel = useCallback(() => {
    setContent('');
    setIsFocused(false);
    setMentionOpen(false);
    textareaRef.current?.blur();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    // Detect @ mention
    const cursorPos = e.target.selectionStart;
    const textUpToCursor = val.slice(0, cursorPos);
    const atMatch = textUpToCursor.match(/@(\w*)$/);

    if (atMatch && mentionUsers.length > 0) {
      setMentionOpen(true);
      setMentionQuery(atMatch[1]);
      setMentionStart(cursorPos - atMatch[0].length);
    } else {
      setMentionOpen(false);
    }
  }, [mentionUsers]);

  const handleMentionSelect = useCallback((user: MentionUser) => {
    const before = content.slice(0, mentionStart);
    const after = content.slice(
      mentionStart + 1 + mentionQuery.length // +1 for @
    );
    const newContent = `${before}@${user.login} ${after}`;
    setContent(newContent);
    setMentionOpen(false);

    // Refocus and place cursor after mention
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        const pos = before.length + user.login.length + 2; // @ + login + space
        textarea.setSelectionRange(pos, pos);
      }
    }, 0);
  }, [content, mentionStart, mentionQuery]);

  return (
    <div ref={containerRef} className="space-y-1.5" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            // Don't unfocus if clicking on Cancel/Send buttons or mention dropdown
            if (e.relatedTarget?.closest('[data-reply-actions]')) return;
            if (!content.trim()) setIsFocused(false);
            // Delay closing mentions so click can register
            setTimeout(() => setMentionOpen(false), 150);
          }}
          placeholder="Reply or add others with @"
          className="min-h-[36px] resize-none text-sm py-2"
          rows={1}
          onKeyDown={(e) => {
            // Let mention dropdown handle arrow keys and enter when open
            if (mentionOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab')) {
              return; // MentionDropdown handles via window listener
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === 'Escape') {
              if (mentionOpen) {
                setMentionOpen(false);
              } else {
                handleCancel();
              }
            }
          }}
        />
        {mentionOpen && (
          <MentionDropdown
            users={mentionUsers}
            query={mentionQuery}
            visible={mentionOpen}
            position={{ top: 4, left: 0 }}
            onSelect={handleMentionSelect}
            onClose={() => setMentionOpen(false)}
          />
        )}
      </div>
      {showActions && (
        <div className="flex justify-end gap-2" data-reply-actions>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSubmit}
            disabled={!content.trim()}
          >
            <Send className="mr-1 h-3 w-3" />
            Send
          </Button>
        </div>
      )}
    </div>
  );
}

export function CommentThread({
  comment,
  replies,
  onReply,
  onResolve,
  onReopen,
  onReaction,
  onEdit,
  onDelete,
  isResolved,
  isActive,
  onSelect,
  mentionUsers,
}: CommentThreadProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleCopyLink = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('comment', comment.id);
    navigator.clipboard.writeText(url.toString());
    toast.success('Link copied to clipboard');
  }, [comment.id]);

  return (
    <div
      className={`relative rounded-lg border p-3 cursor-pointer transition-colors ${
        isResolved ? 'bg-muted/40' : ''
      } ${isActive ? 'ring-2 ring-primary/30' : ''}`}
      onClick={onSelect}
    >
      {/* Resolve & More menu icons in top-right, only when active */}
      {isActive && (
        <div className="absolute top-2 right-2 flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {!isResolved && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onResolve}
              title="Resolve"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
          <DropdownMenu
            open={menuOpen}
            onOpenChange={(open) => {
              setMenuOpen(open);
              if (!open) setConfirmDelete(false);
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="More options"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom">
              {!isResolved && (
                <DropdownMenuItem onClick={() => onEdit?.(comment.id, comment.content)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
              )}
              {isResolved && onReopen && (
                <DropdownMenuItem onClick={onReopen}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Reopen
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={(e) => {
                  if (!confirmDelete) {
                    e.preventDefault();
                    setConfirmDelete(true);
                  } else {
                    onDelete?.(comment.id);
                  }
                }}
              >
                {confirmDelete ? (
                  <>
                    <Check className="mr-2 h-3.5 w-3.5" />
                    Click to confirm
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                <Link2 className="mr-2 h-3.5 w-3.5" />
                Copy link to comment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Main comment */}
      <CommentMessage comment={comment} onReaction={onReaction} />

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-8 mt-3 space-y-3 border-l-2 pl-3">
          {replies.map((reply) => (
            <CommentMessage key={reply.id} comment={reply} onReaction={onReaction} />
          ))}
        </div>
      )}

      {/* Inline reply input – only when active */}
      {isActive && (
        <div className="ml-8 mt-3">
          <InlineReplyInput onSubmit={onReply} mentionUsers={mentionUsers} />
        </div>
      )}
    </div>
  );
}
