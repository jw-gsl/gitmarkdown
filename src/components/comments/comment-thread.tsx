'use client';

import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Check, Smile, Send, MoreVertical, Pencil, Trash2, Link2 } from 'lucide-react';
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
import data from '@emoji-mart/data';
import type { Comment } from '@/types';

const EmojiPicker = dynamic(() => import('@emoji-mart/react').then((mod) => mod.default), {
  ssr: false,
});

interface CommentThreadProps {
  comment: Comment;
  replies: Comment[];
  onReply: (content: string) => void;
  onResolve: () => void;
  onReaction: (emoji: string) => void;
  onEdit?: (commentId: string, newContent: string) => void;
  onDelete?: (commentId: string) => void;
  isResolved?: boolean;
  isActive?: boolean;
  onSelect?: () => void;
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

function CommentMessage({ comment, onReaction }: { comment: Comment; onReaction?: (emoji: string) => void }) {
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
                className="w-auto p-0 border-none shadow-lg"
                align="end"
                side="bottom"
                onClick={(e) => e.stopPropagation()}
              >
                <EmojiPicker
                  data={data}
                  onEmojiSelect={(emoji: { native: string }) => {
                    onReaction(emoji.native);
                    setEmojiOpen(false);
                  }}
                  theme="auto"
                  previewPosition="none"
                  skinTonePosition="none"
                />
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
        {Object.keys(comment.reactions).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Object.entries(comment.reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs hover:bg-accent"
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
}: {
  onSubmit: (content: string) => void;
}) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showActions = isFocused || content.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (!content.trim()) return;
    onSubmit(content.trim());
    setContent('');
    setIsFocused(false);
    textareaRef.current?.blur();
  }, [content, onSubmit]);

  const handleCancel = useCallback(() => {
    setContent('');
    setIsFocused(false);
    textareaRef.current?.blur();
  }, []);

  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          // Don't unfocus if clicking on Cancel/Send buttons
          if (e.relatedTarget?.closest('[data-reply-actions]')) return;
          if (!content.trim()) setIsFocused(false);
        }}
        placeholder="Reply..."
        className="min-h-[36px] resize-none text-sm py-2"
        rows={1}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === 'Escape') {
            handleCancel();
          }
        }}
      />
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
  onReaction,
  onEdit,
  onDelete,
  isResolved,
  isActive,
  onSelect,
}: CommentThreadProps) {
  const handleCopyLink = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('comment', comment.id);
    navigator.clipboard.writeText(url.toString());
  }, [comment.id]);

  return (
    <div
      className={`relative rounded-lg border p-3 ${isResolved ? 'opacity-60' : ''} ${
        isActive ? 'ring-2 ring-primary/30' : ''
      }`}
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
          <DropdownMenu>
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
              <DropdownMenuItem onClick={() => onEdit?.(comment.id, comment.content)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete?.(comment.id)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                <Link2 className="mr-2 h-3.5 w-3.5" />
                Get link to comment
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
          <InlineReplyInput onSubmit={onReply} />
        </div>
      )}
    </div>
  );
}
