'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { MessageSquare, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CommentThread } from './comment-thread';
import type { Comment } from '@/types';

interface CommentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  comments: Comment[];
  onAddComment: (content: string, type: 'comment' | 'suggestion', anchorText?: string) => void;
  onReplyToComment: (parentId: string, content: string) => void;
  onResolveComment: (commentId: string) => void;
  onAddReaction: (commentId: string, emoji: string) => void;
  onEditComment?: (commentId: string, newContent: string) => void;
  onDeleteComment?: (commentId: string) => void;
  activeCommentId?: string | null;
  onSelectComment?: (commentId: string | null) => void;
}

export function CommentSidebar({
  isOpen,
  onClose,
  comments,
  onAddComment,
  onReplyToComment,
  onResolveComment,
  onAddReaction,
  onEditComment,
  onDeleteComment,
  activeCommentId,
  onSelectComment,
}: CommentSidebarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const rootComments = comments.filter((c) => !c.parentCommentId);
  const activeComments = rootComments.filter((c) => c.status === 'active');
  const resolvedComments = rootComments.filter((c) => c.status === 'resolved');

  // Scroll to active comment when it changes
  useEffect(() => {
    if (activeCommentId && isOpen) {
      setTimeout(() => {
        const el = document.querySelector(`[data-comment-id="${activeCommentId}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [activeCommentId, isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
    }
  }, [searchOpen]);

  // Filter comments by search query
  const filteredActive = useMemo(() => {
    if (!searchQuery.trim()) return activeComments;
    const q = searchQuery.toLowerCase();
    return activeComments.filter(
      (c) =>
        c.content.toLowerCase().includes(q) ||
        c.anchorText?.toLowerCase().includes(q) ||
        c.author.displayName.toLowerCase().includes(q)
    );
  }, [activeComments, searchQuery]);

  const filteredResolved = useMemo(() => {
    if (!searchQuery.trim()) return resolvedComments;
    const q = searchQuery.toLowerCase();
    return resolvedComments.filter(
      (c) =>
        c.content.toLowerCase().includes(q) ||
        c.anchorText?.toLowerCase().includes(q) ||
        c.author.displayName.toLowerCase().includes(q)
    );
  }, [resolvedComments, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-72 flex-col border-l bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="font-semibold text-sm">Comments</span>
            {activeComments.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                {activeComments.length}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Search row */}
        <div className="px-4 pb-2">
          {searchOpen ? (
            <div className="flex items-center gap-1.5 rounded-md border px-2 py-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search comments..."
                className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchOpen(false);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => setSearchOpen(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-3 w-3" />
              Search
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {filteredActive.length === 0 && filteredResolved.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              {searchQuery ? (
                <p>No matching comments</p>
              ) : (
                <>
                  <p>No comments yet</p>
                  <p className="text-xs mt-1">Select text to add an inline comment</p>
                </>
              )}
            </div>
          )}

          {filteredActive.map((comment) => (
            <div key={comment.id} data-comment-id={comment.id}>
              <CommentThread
                comment={comment}
                replies={comments.filter((c) => c.parentCommentId === comment.id)}
                onReply={(content) => onReplyToComment(comment.id, content)}
                onResolve={() => onResolveComment(comment.id)}
                onReaction={(emoji) => onAddReaction(comment.id, emoji)}
                onEdit={onEditComment}
                onDelete={onDeleteComment}
                isActive={activeCommentId === comment.id}
                onSelect={() => onSelectComment?.(activeCommentId === comment.id ? null : comment.id)}
              />
            </div>
          ))}

          {filteredResolved.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Resolved ({filteredResolved.length})
              </p>
              {filteredResolved.map((comment) => (
                <div key={comment.id} data-comment-id={comment.id}>
                  <CommentThread
                    comment={comment}
                    replies={comments.filter((c) => c.parentCommentId === comment.id)}
                    onReply={(content) => onReplyToComment(comment.id, content)}
                    onResolve={() => onResolveComment(comment.id)}
                    onReaction={(emoji) => onAddReaction(comment.id, emoji)}
                    onEdit={onEditComment}
                    onDelete={onDeleteComment}
                    isResolved
                    isActive={activeCommentId === comment.id}
                    onSelect={() => onSelectComment?.(activeCommentId === comment.id ? null : comment.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
