'use client';

import { useState } from 'react';
import { Check, Reply, Smile } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CommentInput } from './comment-input';
import type { Comment } from '@/types';

interface CommentThreadProps {
  comment: Comment;
  replies: Comment[];
  onReply: (content: string) => void;
  onResolve: () => void;
  onReaction: (emoji: string) => void;
  isResolved?: boolean;
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

function CommentMessage({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-2.5">
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={comment.author.photoURL || ''} />
        <AvatarFallback className="text-xs">{comment.author.displayName.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium">{comment.author.displayName}</span>
          <span className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
        </div>
        <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
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

export function CommentThread({
  comment,
  replies,
  onReply,
  onResolve,
  onReaction,
  isResolved,
}: CommentThreadProps) {
  const [showReply, setShowReply] = useState(false);

  return (
    <div className={`rounded-lg border p-3 ${isResolved ? 'opacity-60' : ''}`}>
      <CommentMessage comment={comment} />

      {comment.anchorText && (
        <div className="ml-8 mt-2 rounded bg-muted px-2 py-1 text-xs italic text-muted-foreground border-l-2 border-primary">
          &ldquo;{comment.anchorText}&rdquo;
        </div>
      )}

      {replies.length > 0 && (
        <div className="ml-8 mt-3 space-y-3 border-l-2 pl-3">
          {replies.map((reply) => (
            <CommentMessage key={reply.id} comment={reply} />
          ))}
        </div>
      )}

      <div className="ml-8 mt-2 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => setShowReply(!showReply)}
        >
          <Reply className="mr-1 h-3 w-3" />
          Reply
        </Button>
        {!isResolved && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onResolve}
          >
            <Check className="mr-1 h-3 w-3" />
            Resolve
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onReaction('👍')}
        >
          <Smile className="h-3 w-3" />
        </Button>
      </div>

      {showReply && (
        <div className="ml-8 mt-2">
          <CommentInput
            onSubmit={(content) => {
              onReply(content);
              setShowReply(false);
            }}
            onCancel={() => setShowReply(false)}
            placeholder="Reply..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
