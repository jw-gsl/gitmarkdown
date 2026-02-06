'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { MessageSquare, X, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TiptapEditor } from '@/components/editor/tiptap-editor';
import { EditorHeader } from '@/components/editor/editor-header';
import { CommentSidebar } from '@/components/comments/comment-sidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useGitHubContent, useGitHubBranches, useGitHubPulls } from '@/hooks/use-github';
import { useFileStore } from '@/stores/file-store';
import { useSyncStore } from '@/stores/sync-store';
import { useSettingsStore } from '@/stores/settings-store';
import { isMarkdownFile } from '@/lib/editor/markdown-serializer';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { CommitDiffView } from '@/components/github/commit-diff-view';
import { useUIStore } from '@/stores/ui-store';
import {
  subscribeToFileComments,
  addFileComment,
  updateFileComment,
  deleteFileComment,
} from '@/lib/firebase/firestore';
import type { Comment } from '@/types';

/**
 * Lightweight glob matching for file patterns like "**\/*.md" or "*.tsx".
 * Supports ** (any path) and * (any name segment). No external dependency needed.
 */
function matchesGlob(filePath: string, pattern: string): boolean {
  if (!pattern || pattern === '**/*') return true;
  // Convert glob to regex: ** → .*, * → [^/]*, . → \.
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '{{GLOBSTAR}}')
        .replace(/\*/g, '[^/]*')
        .replace(/\{\{GLOBSTAR\}\}/g, '.*') +
      '$'
  );
  return regex.test(filePath);
}

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface PendingComment {
  text: string;
  from: number;
  to: number;
}

export default function FileEditorPage() {
  const params = useParams();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const pathSegments = params.path as string[];
  const filePath = pathSegments.join('/');

  const { loading, fetchContent, updateContent } = useGitHubContent();
  const { fetchBranches, createBranch } = useGitHubBranches();
  const { createPR } = useGitHubPulls();
  const { setCurrentFile, currentFile, markDirty, markClean, syncStatus } = useFileStore();
  const { currentBranch, autoBranchName, setAutoBranchName, setCurrentBranch, setBranches } = useSyncStore();
  const {
    autoCommitDelay,
    saveStrategy,
    autoBranchPrefix,
    autoCreatePR,
    autoCreatePRTitle,
    excludeBranches,
    filePattern,
    commitOnClose,
  } = useSettingsStore();
  const { user } = useAuth();
  const {
    diffViewCommitSha,
    commentSidebarOpen,
    setCommentSidebarOpen,
    setActiveCommentCount,
    setAIChatContext,
    setAISidebarOpen,
    pendingTextEdit,
    setPendingTextEdit,
  } = useUIStore();

  const [content, setContent] = useState<string>('');
  const [sha, setSha] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileLoading, setFileLoading] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');

  // Track whether we've ever loaded a file so we can skip skeletons on subsequent switches
  const hasLoadedOnce = useRef(false);
  // Skip content re-fetch when we programmatically change branch (e.g. auto-save branch creation)
  const skipBranchRefetch = useRef(false);

  // Comment state – persisted in Firestore
  const [comments, setComments] = useState<Comment[]>([]);
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [commentInputValue, setCommentInputValue] = useState('');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const autoCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPRCreated = useRef(false);
  const contentRef = useRef(content);
  const shaRef = useRef(sha);

  // Keep refs in sync with latest state
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    shaRef.current = sha;
  }, [sha]);

  const isMarkdown = isMarkdownFile(filePath);

  useEffect(() => {
    // When we just created an auto-branch and changed currentBranch ourselves,
    // skip the re-fetch — the content is already up-to-date (we just saved it).
    if (skipBranchRefetch.current) {
      skipBranchRefetch.current = false;
      return;
    }
    const loadContent = async () => {
      // Only show loading skeleton on the very first load
      if (!hasLoadedOnce.current) {
        setFileLoading(true);
      }
      try {
        const fileData = await fetchContent(owner, repo, filePath, currentBranch);
        if (fileData) {
          const decoded = fileData.encoding === 'base64'
            ? new TextDecoder().decode(Uint8Array.from(atob(fileData.content.replace(/\n/g, '')), c => c.charCodeAt(0)))
            : fileData.content;
          setContent(decoded);
          setSha(fileData.sha);
          setCurrentFile({
            id: fileData.sha,
            path: filePath,
            name: fileData.name,
            type: 'file',
            sha: fileData.sha,
            isMarkdown,
            content: decoded,
          });
          setIsDirty(false);
          hasLoadedOnce.current = true;
        }
      } catch (error) {
        toast.error('Failed to load file');
      } finally {
        setFileLoading(false);
      }
    };
    loadContent();
  }, [owner, repo, filePath, currentBranch]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setAutoSaveStatus('saving');
    try {
      let targetBranch = currentBranch;

      // If save strategy is 'branch' and no auto-branch created yet, create one
      let isFirstCommitToAutoBranch = false;
      const baseBranch = currentBranch;
      if (saveStrategy === 'branch' && !autoBranchName) {
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const newBranchName = `${autoBranchPrefix}${timestamp}`;

        // Get SHA of current branch to branch from
        const branchList = await fetchBranches(owner, repo);
        const current = branchList?.find((b: { name: string; commit: { sha: string } }) => b.name === currentBranch);
        if (current) {
          await createBranch(owner, repo, newBranchName, current.commit.sha);
          setAutoBranchName(newBranchName);
          // Skip the content re-fetch that currentBranch change would trigger —
          // we're about to save the same content to this new branch.
          skipBranchRefetch.current = true;
          setCurrentBranch(newBranchName);
          targetBranch = newBranchName;
          isFirstCommitToAutoBranch = true;
          // Refresh branches list
          const updated = await fetchBranches(owner, repo);
          if (updated) setBranches(updated.map((br: { name: string }) => br.name));
          toast.success(`Created branch: ${newBranchName}`);
        }
      }

      const result = await updateContent(
        owner,
        repo,
        filePath,
        contentRef.current,
        `Update ${filePath}`,
        shaRef.current,
        targetBranch
      );
      setSha(result.sha);
      setIsDirty(false);
      markClean(filePath);
      setAutoSaveStatus('saved');

      // Auto-create PR after first commit to auto-branch
      if (isFirstCommitToAutoBranch && autoCreatePR && !autoPRCreated.current) {
        autoPRCreated.current = true;
        try {
          await createPR(
            owner,
            repo,
            autoCreatePRTitle || `Auto-save changes from GitMarkdown`,
            `Automated PR created by GitMarkdown auto-save.\n\nBranch: \`${targetBranch}\``,
            targetBranch,
            baseBranch
          );
          toast.success('Pull request created');
        } catch {
          toast.error('Failed to create pull request');
          autoPRCreated.current = false;
        }
      }
      // Clear the "saved" indicator after 3 seconds
      if (autoSavedTimer.current) clearTimeout(autoSavedTimer.current);
      autoSavedTimer.current = setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 3000);
    } catch (error) {
      setAutoSaveStatus('error');
      toast.error('Failed to save file');
    } finally {
      setSaving(false);
    }
  }, [owner, repo, filePath, currentBranch, updateContent, markClean, saveStrategy, autoBranchName, autoBranchPrefix, autoCreatePR, autoCreatePRTitle, fetchBranches, createBranch, createPR, setAutoBranchName, setCurrentBranch, setBranches]);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setIsDirty(true);
      markDirty(filePath);
      setAutoSaveStatus('idle');

      // Reset any pending auto-commit timer
      if (autoCommitTimer.current) {
        clearTimeout(autoCommitTimer.current);
        autoCommitTimer.current = null;
      }

      // Skip auto-commit if disabled, branch is excluded, or file doesn't match pattern
      if (autoCommitDelay <= 0) return;
      if (excludeBranches.includes(currentBranch)) return;
      if (filePattern !== '**/*' && !matchesGlob(filePath, filePattern)) return;

      autoCommitTimer.current = setTimeout(() => {
        handleSave();
      }, autoCommitDelay * 1000);
    },
    [filePath, markDirty, autoCommitDelay, handleSave, excludeBranches, currentBranch, filePattern]
  );

  // Comment handlers
  const handleCommentTrigger = useCallback(
    (data: { text: string; from: number; to: number }) => {
      setPendingComment(data);
      setCommentInputValue('');
      // Focus the input after render
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 50);
    },
    []
  );

  // Chat trigger: add selected text as context in AI sidebar and open it
  const handleChatTrigger = useCallback(
    (data: { text: string; from: number; to: number }) => {
      // Save scroll position before sidebar opens and triggers layout reflow
      const scrollTop = editorContainerRef.current?.scrollTop ?? 0;
      setAIChatContext(data.text);
      setAISidebarOpen(true);
      // Restore scroll position after layout reflow
      requestAnimationFrame(() => {
        if (editorContainerRef.current) {
          editorContainerRef.current.scrollTop = scrollTop;
        }
      });
    },
    [setAIChatContext, setAISidebarOpen]
  );

  const handleSubmitComment = useCallback(
    async (commentContent: string, type: 'comment' | 'suggestion' = 'comment', anchorText?: string) => {
      try {
        await addFileComment(owner, repo, filePath, {
          fileId: sha || filePath,
          author: {
            uid: user?.uid ?? 'anonymous',
            displayName: user?.displayName ?? 'You',
            photoURL: user?.photoURL ?? null,
            githubUsername: owner,
          },
          content: commentContent,
          type,
          anchorStart: pendingComment?.from ?? 0,
          anchorEnd: pendingComment?.to ?? 0,
          anchorText: anchorText ?? pendingComment?.text ?? '',
          reactions: {},
          parentCommentId: null,
          githubCommentId: null,
          status: 'active',
        });
      } catch {
        toast.error('Failed to add comment');
      }
      setPendingComment(null);
      setCommentInputValue('');
      setCommentSidebarOpen(true);
    },
    [pendingComment, sha, filePath, owner, repo, user]
  );

  const handleInlineCommentSubmit = useCallback(() => {
    if (!commentInputValue.trim() || !pendingComment) return;
    handleSubmitComment(commentInputValue.trim(), 'comment', pendingComment.text);
  }, [commentInputValue, pendingComment, handleSubmitComment]);

  const handleReplyToComment = useCallback(
    async (parentId: string, replyContent: string) => {
      const parentComment = comments.find((c) => c.id === parentId);
      try {
        await addFileComment(owner, repo, filePath, {
          fileId: sha || filePath,
          author: {
            uid: user?.uid ?? 'anonymous',
            displayName: user?.displayName ?? 'You',
            photoURL: user?.photoURL ?? null,
            githubUsername: owner,
          },
          content: replyContent,
          type: 'comment',
          anchorStart: parentComment?.anchorStart ?? 0,
          anchorEnd: parentComment?.anchorEnd ?? 0,
          anchorText: parentComment?.anchorText ?? '',
          reactions: {},
          parentCommentId: parentId,
          githubCommentId: null,
          status: 'active',
        });
      } catch {
        toast.error('Failed to add reply');
      }
    },
    [comments, sha, filePath, owner, repo, user]
  );

  const handleResolveComment = useCallback(async (commentId: string) => {
    try {
      await updateFileComment(commentId, { status: 'resolved' });
    } catch {
      toast.error('Failed to resolve comment');
    }
  }, []);

  const handleAddReaction = useCallback(
    async (commentId: string, emoji: string) => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return;
      const uid = user?.uid ?? 'anonymous';
      const existing = comment.reactions[emoji] || [];
      const updatedUsers = existing.includes(uid)
        ? existing.filter((u) => u !== uid)
        : [...existing, uid];
      try {
        await updateFileComment(commentId, {
          reactions: { ...comment.reactions, [emoji]: updatedUsers },
        });
      } catch {
        toast.error('Failed to update reaction');
      }
    },
    [comments, user]
  );

  const handleEditComment = useCallback(async (commentId: string, newContent: string) => {
    try {
      await updateFileComment(commentId, { content: newContent });
    } catch {
      toast.error('Failed to edit comment');
    }
  }, []);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await deleteFileComment(commentId);
      toast.success('Comment deleted');
    } catch {
      toast.error('Failed to delete comment');
    }
  }, []);

  const handleHighlightClick = useCallback(
    (data: { text: string; from: number; to: number }) => {
      // Find the comment matching this highlighted text by anchorText
      const match = comments.find(
        (c) => !c.parentCommentId && c.anchorText === data.text
      );
      if (match) {
        setActiveCommentId(match.id);
        setCommentSidebarOpen(true);
      }
    },
    [comments, setCommentSidebarOpen]
  );

  const handleSelectComment = useCallback(
    (commentId: string | null) => {
      setActiveCommentId(commentId);

      // Scroll the editor to show the highlighted anchor text
      if (commentId) {
        const comment = comments.find((c) => c.id === commentId);
        if (comment?.anchorText) {
          requestAnimationFrame(() => {
            const marks = document.querySelectorAll('mark[data-color="#FEF9C3"]');
            for (const mark of marks) {
              if (mark.textContent?.includes(comment.anchorText)) {
                mark.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                break;
              }
            }
          });
        }
      }
    },
    [comments]
  );

  const handleSidebarAddComment = useCallback(
    async (commentContent: string, type: 'comment' | 'suggestion', anchorText?: string) => {
      try {
        await addFileComment(owner, repo, filePath, {
          fileId: sha || filePath,
          author: {
            uid: user?.uid ?? 'anonymous',
            displayName: user?.displayName ?? 'You',
            photoURL: user?.photoURL ?? null,
            githubUsername: owner,
          },
          content: commentContent,
          type,
          anchorStart: 0,
          anchorEnd: 0,
          anchorText: anchorText ?? '',
          reactions: {},
          parentCommentId: null,
          githubCommentId: null,
          status: 'active',
        });
      } catch {
        toast.error('Failed to add comment');
      }
    },
    [sha, filePath, owner, repo, user]
  );

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (autoCommitTimer.current) clearTimeout(autoCommitTimer.current);
      if (autoSavedTimer.current) clearTimeout(autoSavedTimer.current);
    };
  }, []);

  // Commit on close: save dirty changes when user navigates away or closes tab
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (!commitOnClose) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        // Fire save via sendBeacon (best-effort, non-blocking)
        handleSave();
        // Also show browser confirmation dialog as fallback
        e.preventDefault();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isDirtyRef.current) {
        handleSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [commitOnClose, handleSave]);

  // Subscribe to Firestore comments for this file (real-time sync)
  useEffect(() => {
    const unsubscribe = subscribeToFileComments(
      owner,
      repo,
      filePath,
      (firestoreComments) => {
        setComments(firestoreComments);
      }
    );
    return () => unsubscribe();
  }, [owner, repo, filePath]);

  // Keyboard shortcut for save (Cmd+S / Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty) {
          // Cancel any pending auto-commit since user is manually saving
          if (autoCommitTimer.current) clearTimeout(autoCommitTimer.current);
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, handleSave]);

  // Apply text edits from AI sidebar tool calls
  useEffect(() => {
    if (!pendingTextEdit) return;
    const { oldText, newText } = pendingTextEdit;

    // Find and replace in the current content
    const currentContent = contentRef.current;
    if (currentContent.includes(oldText)) {
      const updated = currentContent.replace(oldText, newText);
      setContent(updated);
      setIsDirty(true);
      markDirty(filePath);
      toast.success('Edit applied');
    } else {
      toast.error('Could not find the text to replace');
    }

    setPendingTextEdit(null);
  }, [pendingTextEdit, setPendingTextEdit, filePath, markDirty]);

  const activeCommentCount = comments.filter(
    (c) => !c.parentCommentId && c.status === 'active'
  ).length;

  // Collect anchor texts for highlighting in the editor
  const commentAnchors = useMemo(
    () =>
      comments
        .filter((c) => !c.parentCommentId && c.status === 'active' && c.anchorText)
        .map((c) => c.anchorText),
    [comments]
  );

  // Sync comment count to UI store for the header badge
  useEffect(() => {
    setActiveCommentCount(activeCommentCount);
  }, [activeCommentCount, setActiveCommentCount]);

  return (
    <div className="flex h-full flex-col">
      <EditorHeader
        isDirty={isDirty}
        autoSaveStatus={autoSaveStatus}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Main editor area */}
        <div ref={editorContainerRef} className="relative flex-1 overflow-auto">
          {diffViewCommitSha ? (
            <CommitDiffView owner={owner} repo={repo} filePath={filePath} />
          ) : (
            <>
              {isMarkdown ? (
                fileLoading ? (
                  <div className="flex-1 overflow-auto p-8">
                    <div className="mx-auto max-w-3xl space-y-4">
                      <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                      <div className="mt-6 h-4 w-full animate-pulse rounded bg-muted" />
                      <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ) : (
                  <TiptapEditor
                    content={content}
                    onChange={handleContentChange}
                    onComment={handleCommentTrigger}
                    onChat={handleChatTrigger}
                    onHighlightClick={handleHighlightClick}
                    pendingComment={pendingComment}
                    commentAnchors={commentAnchors}
                    className="flex-1 overflow-auto"
                  />
                )
              ) : (
                <div className="flex-1 overflow-auto">
                  {fileLoading ? (
                    <div className="p-6 space-y-3">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                    </div>
                  ) : (
                    <pre className="p-6 font-mono text-sm">{content}</pre>
                  )}
                </div>
              )}
            </>
          )}

          {/* Floating inline comment input */}
          {pendingComment && (
            <div className="absolute right-4 top-20 z-50 w-72 rounded-lg border bg-background p-3 shadow-xl">
              <div className="mb-2 flex items-center gap-2">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={user?.photoURL || ''} />
                  <AvatarFallback className="text-[10px]">
                    {user?.displayName?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium truncate">{user?.displayName || 'You'}</span>
              </div>
              <Textarea
                ref={commentInputRef}
                value={commentInputValue}
                onChange={(e) => setCommentInputValue(e.target.value)}
                placeholder="Comment or add others with @"
                className="min-h-[60px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleInlineCommentSubmit();
                  }
                  if (e.key === 'Escape') {
                    setPendingComment(null);
                    setCommentInputValue('');
                  }
                }}
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setPendingComment(null);
                    setCommentInputValue('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleInlineCommentSubmit}
                  disabled={!commentInputValue.trim()}
                >
                  Comment
                </Button>
              </div>
            </div>
          )}

        </div>

        {/* Comment sidebar */}
        <CommentSidebar
          isOpen={commentSidebarOpen}
          onClose={() => setCommentSidebarOpen(false)}
          comments={comments}
          onAddComment={handleSidebarAddComment}
          onReplyToComment={handleReplyToComment}
          onResolveComment={handleResolveComment}
          onAddReaction={handleAddReaction}
          onEditComment={handleEditComment}
          onDeleteComment={handleDeleteComment}
          activeCommentId={activeCommentId}
          onSelectComment={handleSelectComment}
        />
      </div>
    </div>
  );
}
