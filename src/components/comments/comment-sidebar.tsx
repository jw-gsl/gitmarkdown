'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CommentThread } from './comment-thread';
import { CommentInput } from './comment-input';
import type { Comment } from '@/types';

interface CommentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  comments: Comment[];
  onAddComment: (content: string, type: 'comment' | 'suggestion', anchorText?: string) => void;
  onReplyToComment: (parentId: string, content: string) => void;
  onResolveComment: (commentId: string) => void;
  onAddReaction: (commentId: string, emoji: string) => void;
}

export function CommentSidebar({
  isOpen,
  onClose,
  comments,
  onAddComment,
  onReplyToComment,
  onResolveComment,
  onAddReaction,
}: CommentSidebarProps) {
  const [showNewComment, setShowNewComment] = useState(false);

  const rootComments = comments.filter((c) => !c.parentCommentId);
  const activeComments = rootComments.filter((c) => c.status === 'active');
  const resolvedComments = rootComments.filter((c) => c.status === 'resolved');

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-72 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="font-semibold text-sm">Comments</span>
          {activeComments.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              {activeComments.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowNewComment(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {showNewComment && (
            <div className="rounded-lg border p-3">
              <CommentInput
                onSubmit={(content) => {
                  onAddComment(content, 'comment');
                  setShowNewComment(false);
                }}
                onCancel={() => setShowNewComment(false)}
                placeholder="Add a comment..."
              />
            </div>
          )}

          {activeComments.length === 0 && !showNewComment && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <p>No comments yet</p>
              <p className="text-xs mt-1">Select text to add an inline comment</p>
            </div>
          )}

          {activeComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              replies={comments.filter((c) => c.parentCommentId === comment.id)}
              onReply={(content) => onReplyToComment(comment.id, content)}
              onResolve={() => onResolveComment(comment.id)}
              onReaction={(emoji) => onAddReaction(comment.id, emoji)}
            />
          ))}

          {resolvedComments.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Resolved ({resolvedComments.length})
              </p>
              {resolvedComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  replies={comments.filter((c) => c.parentCommentId === comment.id)}
                  onReply={(content) => onReplyToComment(comment.id, content)}
                  onResolve={() => onResolveComment(comment.id)}
                  onReaction={(emoji) => onAddReaction(comment.id, emoji)}
                  isResolved
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
