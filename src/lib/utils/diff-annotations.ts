import type { DiffLineAnnotation } from '@pierre/diffs';
import type { Comment, GitHubReviewComment } from '@/types';
import { charOffsetToLineNumber } from '@/lib/github/position-mapping';

export interface CommentAnnotationMeta {
  commentId: string;
  parentCommentId: string | null;
  author: Comment['author'];
  content: string;
  status: Comment['status'];
  createdAt: Date;
}

/**
 * Convert GitMarkdown comments to @pierre/diffs DiffLineAnnotation objects.
 *
 * Comments use character offsets (anchorStart). We convert these to line numbers
 * relative to the "additions" side of the diff (the new file content).
 */
export function commentsToAnnotations(
  comments: Comment[],
  fileContent: string
): DiffLineAnnotation<CommentAnnotationMeta>[] {
  // Only include root-level active comments (not replies)
  const rootComments = comments.filter(
    (c) => !c.parentCommentId && c.status === 'active'
  );

  return rootComments.map((comment) => {
    const lineNumber = charOffsetToLineNumber(fileContent, comment.anchorStart);
    return {
      side: 'additions' as const,
      lineNumber,
      metadata: {
        commentId: comment.id,
        parentCommentId: comment.parentCommentId,
        author: comment.author,
        content: comment.content,
        status: comment.status,
        createdAt: comment.createdAt,
      },
    };
  });
}

/**
 * Convert GitHub PR review comments to @pierre/diffs DiffLineAnnotation objects.
 *
 * GitHub review comments already have line numbers. We place them on the
 * "additions" side (new file) when available.
 */
export function githubCommentsToAnnotations(
  comments: GitHubReviewComment[]
): DiffLineAnnotation<{ ghId: number; body: string; author: string; avatarUrl: string }>[] {
  // Only include root comments (not replies)
  const rootComments = comments.filter((c) => !c.in_reply_to_id);

  return rootComments
    .filter((c) => c.line !== null)
    .map((comment) => ({
      side: 'additions' as const,
      lineNumber: comment.line!,
      metadata: {
        ghId: comment.id,
        body: comment.body,
        author: comment.user?.login ?? 'unknown',
        avatarUrl: comment.user?.avatar_url ?? '',
      },
    }));
}
