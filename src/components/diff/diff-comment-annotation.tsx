'use client';

import type { DiffLineAnnotation } from '@pierre/diffs';
import type { CommentAnnotationMeta } from '@/lib/utils/diff-annotations';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare } from 'lucide-react';

/**
 * Renders a comment annotation inline in the diff view.
 * Used as the `renderAnnotation` callback for PierrePatchDiffView / PierreContentDiffView.
 */
export function DiffCommentAnnotation({
  annotation,
}: {
  annotation: DiffLineAnnotation<CommentAnnotationMeta>;
}) {
  const { metadata } = annotation;
  if (!metadata) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-yellow-50/50 dark:bg-yellow-950/20 border-t border-yellow-200/50 dark:border-yellow-800/30 text-xs">
      <Avatar className="h-5 w-5 shrink-0 mt-0.5">
        {metadata.author.photoURL && (
          <AvatarImage src={metadata.author.photoURL} alt={metadata.author.displayName} />
        )}
        <AvatarFallback className="text-xs">
          {metadata.author.displayName?.charAt(0)?.toUpperCase() ?? '?'}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <span className="font-medium text-foreground">{metadata.author.displayName}</span>
        <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
          {metadata.content}
        </p>
      </div>
      <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
    </div>
  );
}

/**
 * Renders a GitHub review comment annotation inline in the diff view.
 */
export function GitHubCommentAnnotation({
  annotation,
}: {
  annotation: DiffLineAnnotation<{ ghId: number; body: string; author: string; avatarUrl: string }>;
}) {
  const { metadata } = annotation;
  if (!metadata) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-blue-50/50 dark:bg-blue-950/20 border-t border-blue-200/50 dark:border-blue-800/30 text-xs">
      <Avatar className="h-5 w-5 shrink-0 mt-0.5">
        {metadata.avatarUrl && <AvatarImage src={metadata.avatarUrl} alt={metadata.author} />}
        <AvatarFallback className="text-xs">
          {metadata.author.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <span className="font-medium text-foreground">{metadata.author}</span>
        <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
          {metadata.body}
        </p>
      </div>
      <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
    </div>
  );
}
