'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { MessageSquare, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CommentThread } from './comment-thread';
import type { MentionUser } from './mention-dropdown';
import type { Comment } from '@/types';

interface CommentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  comments: Comment[];
  onAddComment: (content: string, type: 'comment' | 'suggestion', anchorText?: string) => void;
  onReplyToComment: (parentId: string, content: string) => void;
  onResolveComment: (commentId: string) => void;
  onReopenComment?: (commentId: string) => void;
  onAddReaction: (commentId: string, emoji: string) => void;
  onEditComment?: (commentId: string, newContent: string) => void;
  onDeleteComment?: (commentId: string) => void;
  activeCommentId?: string | null;
  onSelectComment?: (commentId: string | null) => void;
  currentUserId?: string;
  mentionUsers?: MentionUser[];
}

export function CommentSidebar({
  isOpen,
  onClose,
  comments,
  onAddComment,
  onReplyToComment,
  onResolveComment,
  onReopenComment,
  onAddReaction,
  onEditComment,
  onDeleteComment,
  activeCommentId,
  onSelectComment,
  currentUserId,
  mentionUsers,
}: CommentSidebarProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'foryou'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const rootComments = comments.filter((c) => !c.parentCommentId);
  const activeComments = rootComments
    .filter((c) => c.status === 'active')
    .sort((a, b) => (a.anchorStart ?? 0) - (b.anchorStart ?? 0));
  const resolvedComments = rootComments
    .filter((c) => c.status === 'resolved')
    .sort((a, b) => (a.anchorStart ?? 0) - (b.anchorStart ?? 0));

  // "For you" filter: comments where current user authored or replied
  const forYouIds = useMemo(() => {
    if (!currentUserId) return new Set<string>();
    const ids = new Set<string>();
    rootComments.forEach((c) => {
      if (c.author.uid === currentUserId) {
        ids.add(c.id);
      }
      if (comments.some((r) => r.parentCommentId === c.id && r.author.uid === currentUserId)) {
        ids.add(c.id);
      }
    });
    return ids;
  }, [rootComments, comments, currentUserId]);

  // Scroll to active comment when it changes
  useEffect(() => {
    if (activeCommentId && isOpen) {
      setTimeout(() => {
        const el = document.querySelector(`[data-comment-id="${activeCommentId}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [activeCommentId, isOpen]);

  // Filter by search query and active tab
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const matchSearch = (c: Comment) => {
      if (!q) return true;
      return (
        c.content.toLowerCase().includes(q) ||
        c.anchorText?.toLowerCase().includes(q) ||
        c.author.displayName.toLowerCase().includes(q)
      );
    };

    const matchTab = (c: Comment) => {
      if (activeTab === 'foryou') return forYouIds.has(c.id);
      return true;
    };

    return {
      active: activeComments.filter((c) => matchSearch(c) && matchTab(c)),
      resolved: resolvedComments.filter((c) => matchSearch(c) && matchTab(c)),
    };
  }, [activeComments, resolvedComments, searchQuery, activeTab, forYouIds]);

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="font-semibold text-sm">Comments</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-4 pb-2">
          <div className="flex gap-4">
            <button
              className={`pb-1.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'all'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('all')}
            >
              All comments
            </button>
            <button
              className={`pb-1.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'foryou'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('foryou')}
            >
              For you
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="px-4 pt-2 pb-2">
          <div className="flex items-center gap-1.5 rounded-md border px-2 py-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search comments..."
              className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {filtered.active.length === 0 && filtered.resolved.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              {searchQuery ? (
                <p>No matching comments</p>
              ) : activeTab === 'foryou' ? (
                <p>No comments for you yet</p>
              ) : (
                <>
                  <p>No comments yet</p>
                  <p className="text-xs mt-1">Select text to add an inline comment</p>
                </>
              )}
            </div>
          )}

          {filtered.active.map((comment) => (
            <div key={comment.id} data-comment-id={comment.id}>
              <CommentThread
                comment={comment}
                replies={comments.filter((c) => c.parentCommentId === comment.id)}
                onReply={(content) => onReplyToComment(comment.id, content)}
                onResolve={() => onResolveComment(comment.id)}
                onReaction={onAddReaction}
                onEdit={onEditComment}
                onDelete={onDeleteComment}
                isActive={activeCommentId === comment.id}
                onSelect={() => onSelectComment?.(activeCommentId === comment.id ? null : comment.id)}
                mentionUsers={mentionUsers}
              />
            </div>
          ))}

          {filtered.resolved.length > 0 && (
            <div className="mt-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                Resolved ({filtered.resolved.length})
              </p>
              <div className="space-y-3">
                {filtered.resolved.map((comment) => (
                  <div key={comment.id} data-comment-id={comment.id}>
                    <CommentThread
                      comment={comment}
                      replies={comments.filter((c) => c.parentCommentId === comment.id)}
                      onReply={(content) => onReplyToComment(comment.id, content)}
                      onResolve={() => onResolveComment(comment.id)}
                      onReopen={() => onReopenComment?.(comment.id)}
                      onReaction={onAddReaction}
                      onEdit={onEditComment}
                      onDelete={onDeleteComment}
                      isResolved
                      isActive={activeCommentId === comment.id}
                      onSelect={() => onSelectComment?.(activeCommentId === comment.id ? null : comment.id)}
                      mentionUsers={mentionUsers}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
