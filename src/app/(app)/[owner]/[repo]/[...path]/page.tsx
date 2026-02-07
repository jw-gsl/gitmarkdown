'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { MessageSquare, X, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TiptapEditor } from '@/components/editor/tiptap-editor';
import { EditorHeader } from '@/components/editor/editor-header';
import { CommentSidebar } from '@/components/comments/comment-sidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useGitHubContent, useGitHubBranches, useGitHubPulls, useGitHubCollaborators, useGitHubReviewComments } from '@/hooks/use-github';
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
import { MentionDropdown, type MentionUser } from '@/components/comments/mention-dropdown';
import type { Comment } from '@/types';
import { findAnchorInMarkdown, emojiToGitHubReaction } from '@/lib/github/position-mapping';

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
  const searchParams = useSearchParams();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const pathSegments = params.path as string[];
  const filePath = pathSegments.join('/');

  const { loading, fetchContent, updateContent } = useGitHubContent();
  const { fetchBranches, createBranch } = useGitHubBranches();
  const { createPR, fetchPRForBranch } = useGitHubPulls();
  const { collaborators, fetchCollaborators } = useGitHubCollaborators();
  const {
    createComment: createGHComment,
    replyToComment: replyToGHComment,
    updateComment: updateGHComment,
    deleteComment: deleteGHComment,
  } = useGitHubReviewComments();
  const { setCurrentFile, currentFile, markDirty, markClean, syncStatus } = useFileStore();
  const { currentBranch, autoBranchName, setAutoBranchName, setCurrentBranch, setBranches, activePR, setActivePR, clearActivePR } = useSyncStore();
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
  // rawComments holds everything from Firestore; `comments` is filtered by branch
  const [rawComments, setRawComments] = useState<Comment[]>([]);
  const comments = useMemo(
    () => rawComments.filter((c) => !c.branch || c.branch === currentBranch),
    [rawComments, currentBranch]
  );
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [commentInputValue, setCommentInputValue] = useState('');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const [commentInputTop, setCommentInputTop] = useState<number>(80);
  const [inlineMentionOpen, setInlineMentionOpen] = useState(false);
  const [inlineMentionQuery, setInlineMentionQuery] = useState('');
  const [inlineMentionStart, setInlineMentionStart] = useState(-1);
  const deepLinkHandled = useRef(false);

  // Track firestoreDocId → githubCommentId immediately on creation (bypasses Firestore round-trip)
  const ghCommentIdMap = useRef(new Map<string, string>());

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const autoCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPRCreated = useRef(false);
  const contentRef = useRef(content);
  const shaRef = useRef(sha);

  /** Get the GitHub comment ID for a Firestore comment, checking both local state and the immediate map */
  const getGHCommentId = useCallback((commentId: string): number | null => {
    // First check immediate map (for recently created comments)
    const mapped = ghCommentIdMap.current.get(commentId);
    if (mapped) return parseInt(mapped, 10);
    // Then check Firestore-synced state
    const comment = comments.find((c) => c.id === commentId);
    if (comment?.githubCommentId) return parseInt(comment.githubCommentId, 10);
    return null;
  }, [comments]);

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

      // Update activePR headSha so subsequent GitHub review comment calls use the latest commit
      if (activePR && result.commitSha) {
        setActivePR({ ...activePR, headSha: result.commitSha });
      }

      // Auto-create PR after first commit to auto-branch
      if (isFirstCommitToAutoBranch && autoCreatePR && !autoPRCreated.current) {
        autoPRCreated.current = true;
        try {
          const prResult = await createPR(
            owner,
            repo,
            autoCreatePRTitle || `Auto-save changes from GitMarkdown`,
            `Automated PR created by GitMarkdown auto-save.\n\nBranch: \`${targetBranch}\``,
            targetBranch,
            baseBranch
          );
          toast.success('Pull request created');
          // Set activePR so comment sync works immediately
          if (prResult?.number) {
            setActivePR({
              number: prResult.number,
              headSha: result.commitSha || result.sha,
              baseRef: baseBranch,
              htmlUrl: prResult.html_url || '',
            });
          }
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
  }, [owner, repo, filePath, currentBranch, updateContent, markClean, saveStrategy, autoBranchName, autoBranchPrefix, autoCreatePR, autoCreatePRTitle, fetchBranches, createBranch, createPR, setAutoBranchName, setCurrentBranch, setBranches, activePR, setActivePR]);

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

      // Calculate vertical position relative to editor container
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && editorContainerRef.current) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = editorContainerRef.current.getBoundingClientRect();
        const scrollTop = editorContainerRef.current.scrollTop;
        const top = rect.top - containerRect.top + scrollTop;
        setCommentInputTop(Math.max(16, top));
      }

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
        const docRef = await addFileComment(owner, repo, filePath, {
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
          branch: currentBranch,
        });

        // Outbound sync: push to GitHub PR (fire-and-forget)
        if (activePR && contentRef.current) {
          const anchor = anchorText ?? pendingComment?.text ?? '';
          const lineInfo = findAnchorInMarkdown(contentRef.current, anchor, pendingComment?.from);
          const line = lineInfo?.line || 1;
          createGHComment(
            owner, repo, activePR.number, commentContent,
            activePR.headSha, filePath, line, lineInfo?.startLine
          ).then((ghComment) => {
            const ghId = ghComment.id.toString();
            ghCommentIdMap.current.set(docRef.id, ghId);
            updateFileComment(docRef.id, { githubCommentId: ghId }).catch(() => {});
          }).catch(() => {
            // Silent — outbound sync is fire-and-forget
          });
        }
      } catch {
        toast.error('Failed to add comment');
      }
      setPendingComment(null);
      setCommentInputValue('');
      setCommentSidebarOpen(true);
    },
    [pendingComment, sha, filePath, owner, repo, user, currentBranch, activePR, createGHComment]
  );

  const handleInlineCommentSubmit = useCallback(() => {
    if (!commentInputValue.trim() || !pendingComment) return;
    handleSubmitComment(commentInputValue.trim(), 'comment', pendingComment.text);
  }, [commentInputValue, pendingComment, handleSubmitComment]);

  const handleReplyToComment = useCallback(
    async (parentId: string, replyContent: string) => {
      const parentComment = comments.find((c) => c.id === parentId);
      try {
        const docRef = await addFileComment(owner, repo, filePath, {
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
          branch: currentBranch,
        });

        // Outbound sync: reply on GitHub if parent has githubCommentId
        const parentGHId = getGHCommentId(parentId);
        if (activePR && parentGHId) {
          replyToGHComment(
            owner, repo, activePR.number,
            parentGHId,
            replyContent
          ).then((ghComment) => {
            const ghId = ghComment.id.toString();
            ghCommentIdMap.current.set(docRef.id, ghId);
            updateFileComment(docRef.id, { githubCommentId: ghId }).catch(() => {});
          }).catch(() => {});
        }
      } catch {
        toast.error('Failed to add reply');
      }
    },
    [comments, sha, filePath, owner, repo, user, currentBranch, activePR, replyToGHComment, getGHCommentId]
  );

  const handleResolveComment = useCallback(async (commentId: string) => {
    try {
      await updateFileComment(commentId, { status: 'resolved' });

      // Outbound sync: resolve thread on GitHub via GraphQL
      const comment = comments.find((c) => c.id === commentId);
      if (activePR && comment?.githubThreadId && user) {
        user.getIdToken().then((idToken) => {
          fetch('/api/github/review-comments', {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ threadId: comment.githubThreadId, action: 'resolve' }),
          }).catch(() => {});
        }).catch(() => {});
      }
    } catch {
      toast.error('Failed to resolve comment');
    }
  }, [comments, activePR, user]);

  const handleReopenComment = useCallback(async (commentId: string) => {
    try {
      await updateFileComment(commentId, { status: 'active' });

      // Outbound sync: unresolve thread on GitHub via GraphQL
      const comment = comments.find((c) => c.id === commentId);
      if (activePR && comment?.githubThreadId && user) {
        user.getIdToken().then((idToken) => {
          fetch('/api/github/review-comments', {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ threadId: comment.githubThreadId, action: 'unresolve' }),
          }).catch(() => {});
        }).catch(() => {});
      }
    } catch {
      toast.error('Failed to reopen comment');
    }
  }, [comments, activePR, user]);

  const handleAddReaction = useCallback(
    async (commentId: string, emoji: string) => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return;
      const uid = user?.uid ?? 'anonymous';
      const existing = comment.reactions[emoji] || [];
      const isRemoving = existing.includes(uid);
      const updatedUsers = isRemoving
        ? existing.filter((u) => u !== uid)
        : [...existing, uid];

      // Clean up: remove empty reaction arrays instead of leaving them with 0
      const newReactions = { ...comment.reactions };
      if (updatedUsers.length === 0) {
        delete newReactions[emoji];
      } else {
        newReactions[emoji] = updatedUsers;
      }

      try {
        await updateFileComment(commentId, { reactions: newReactions });

        // Outbound sync: add or remove reaction on GitHub
        const ghId = getGHCommentId(commentId);
        const ghReaction = emojiToGitHubReaction(emoji);
        if (activePR && ghId && ghReaction && user) {
          user.getIdToken().then((idToken) => {
            fetch('/api/github/review-comments', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${idToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                owner,
                repo,
                reaction: ghReaction,
                commentId: ghId,
                ...(isRemoving ? { removeReaction: owner } : {}),
              }),
            }).catch(() => {});
          }).catch(() => {});
        }
      } catch {
        toast.error('Failed to update reaction');
      }
    },
    [comments, user, activePR, owner, repo, getGHCommentId]
  );

  const handleEditComment = useCallback(async (commentId: string, newContent: string) => {
    try {
      await updateFileComment(commentId, { content: newContent });

      // Outbound sync: update on GitHub
      const ghId = getGHCommentId(commentId);
      if (activePR && ghId) {
        updateGHComment(
          owner, repo,
          ghId,
          newContent
        ).catch(() => {});
      }
    } catch {
      toast.error('Failed to edit comment');
    }
  }, [activePR, owner, repo, updateGHComment, getGHCommentId]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    // Get GitHub ID before deleting locally
    const ghId = getGHCommentId(commentId);
    try {
      await deleteFileComment(commentId);
      toast.success('Comment deleted');

      // Outbound sync: delete on GitHub
      if (activePR && ghId) {
        deleteGHComment(
          owner, repo,
          ghId
        ).catch(() => {});
      }
    } catch {
      toast.error('Failed to delete comment');
    }
  }, [activePR, owner, repo, deleteGHComment, getGHCommentId]);

  const handleHighlightClick = useCallback(
    (data: { text: string; from: number; to: number }) => {
      // Find the comment matching this highlighted text by anchorText (flexible matching)
      const match = comments.find(
        (c) =>
          !c.parentCommentId &&
          c.status === 'active' &&
          c.anchorText &&
          (c.anchorText === data.text ||
            data.text.includes(c.anchorText) ||
            c.anchorText.includes(data.text))
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

      // Scroll the editor to show the highlighted anchor text.
      // Wait for the editor effect to apply comment-active class, then scroll to it.
      if (commentId) {
        setTimeout(() => {
          const container = editorContainerRef.current;
          if (!container) return;
          const activeMark = container.querySelector('mark.comment-active');
          if (activeMark) {
            activeMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 80);
      }
    },
    []
  );

  const handleSidebarAddComment = useCallback(
    async (commentContent: string, type: 'comment' | 'suggestion', anchorText?: string) => {
      try {
        const docRef = await addFileComment(owner, repo, filePath, {
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
          branch: currentBranch,
        });

        // Outbound sync: push to GitHub PR (fire-and-forget)
        if (activePR && contentRef.current && anchorText) {
          const lineInfo = findAnchorInMarkdown(contentRef.current, anchorText);
          const line = lineInfo?.line || 1;
          createGHComment(
            owner, repo, activePR.number, commentContent,
            activePR.headSha, filePath, line, lineInfo?.startLine
          ).then((ghComment) => {
            const ghId = ghComment.id.toString();
            ghCommentIdMap.current.set(docRef.id, ghId);
            updateFileComment(docRef.id, { githubCommentId: ghId }).catch(() => {});
          }).catch(() => {});
        }
      } catch {
        toast.error('Failed to add comment');
      }
    },
    [sha, filePath, owner, repo, user, currentBranch, activePR, createGHComment]
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
        setRawComments(firestoreComments);
      }
    );
    return () => unsubscribe();
  }, [owner, repo, filePath]);

  // Clear active comment selection when branch changes (comment may not exist on new branch)
  const prevBranch = useRef(currentBranch);
  useEffect(() => {
    if (prevBranch.current !== currentBranch) {
      setActiveCommentId(null);
      prevBranch.current = currentBranch;
    }
  }, [currentBranch]);

  // Auto-resolve orphaned comments whose anchor text no longer exists in the document
  const orphanCheckKey = useRef('');
  useEffect(() => {
    const key = `${filePath}:${currentBranch}`;
    if (orphanCheckKey.current === key || fileLoading || !content || !comments.length) return;
    orphanCheckKey.current = key;

    const activeRoots = comments.filter(
      (c) => !c.parentCommentId && c.status === 'active' && c.anchorText
    );
    for (const c of activeRoots) {
      if (!content.includes(c.anchorText)) {
        updateFileComment(c.id, { status: 'resolved' }).catch(() => {});
      }
    }
  }, [content, comments, fileLoading, filePath, currentBranch]);

  // Fetch repo collaborators for @ mentions
  useEffect(() => {
    fetchCollaborators(owner, repo);
  }, [owner, repo, fetchCollaborators]);

  // PR detection: check if current branch has an open PR
  const prDetected = useRef(false);
  useEffect(() => {
    prDetected.current = false;
    clearActivePR();

    const detectPR = async () => {
      try {
        const pr = await fetchPRForBranch(owner, repo, currentBranch);
        if (pr) {
          setActivePR(pr);
          prDetected.current = true;
        }
      } catch {
        // Silent — PR detection is best-effort
      }
    };
    detectPR();
  }, [owner, repo, currentBranch, fetchPRForBranch, setActivePR, clearActivePR]);

  // Inbound sync: pull GitHub PR review comments periodically
  const lastInboundSync = useRef<string | null>(null);
  const inboundSyncInFlight = useRef(false);

  const runInboundSync = useCallback(async () => {
    if (!activePR || !user || inboundSyncInFlight.current) return;
    inboundSyncInFlight.current = true;
    try {
      const idToken = await user.getIdToken();
      await fetch('/api/comments/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          pullNumber: activePR.number,
          filePath,
          direction: 'from-github',
        }),
      });
    } catch {
      // Silent — inbound sync is best-effort
    } finally {
      inboundSyncInFlight.current = false;
    }
  }, [activePR, user, owner, repo, filePath]);

  // Initial sync when PR is first detected
  useEffect(() => {
    if (!activePR) return;
    const syncKey = `${activePR.number}:${filePath}`;
    if (lastInboundSync.current === syncKey) return;
    lastInboundSync.current = syncKey;
    runInboundSync();
  }, [activePR, filePath, runInboundSync]);

  // Re-sync on window focus (user may have been on GitHub tab)
  useEffect(() => {
    if (!activePR) return;
    const handleFocus = () => runInboundSync();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activePR, runInboundSync]);

  // Periodic re-sync every 30 seconds
  useEffect(() => {
    if (!activePR) return;
    const interval = setInterval(runInboundSync, 30_000);
    return () => clearInterval(interval);
  }, [activePR, runInboundSync]);

  // Deep link: open comment from ?comment= URL param
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const commentId = searchParams.get('comment');
    if (commentId && comments.length > 0) {
      const exists = comments.find((c) => c.id === commentId);
      if (exists) {
        setActiveCommentId(commentId);
        setCommentSidebarOpen(true);
        deepLinkHandled.current = true;
      }
    }
  }, [searchParams, comments, setCommentSidebarOpen]);

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

  // Active comment's anchor text for orange highlight in editor
  const activeAnchorText = useMemo(() => {
    if (!activeCommentId) return null;
    const comment = comments.find((c) => c.id === activeCommentId);
    return comment?.anchorText || null;
  }, [activeCommentId, comments]);

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
                  <div className="min-h-full bg-accent/40 dark:bg-neutral-950">
                    <div className="mx-auto max-w-3xl min-h-[calc(100vh-8rem)] bg-background editor-page rounded-lg px-16 py-10">
                      <div className="space-y-4">
                        <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                        <div className="mt-6 h-4 w-full animate-pulse rounded bg-muted" />
                        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                      </div>
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
                    activeAnchorText={activeAnchorText}
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

          {/* Floating inline comment input – positioned next to selected text */}
          {pendingComment && (
            <div
              className="absolute right-4 z-50 w-72 rounded-lg border bg-background p-3 shadow-xl"
              style={{ top: commentInputTop }}
            >
              <div className="mb-2 flex items-center gap-2">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={user?.photoURL || ''} />
                  <AvatarFallback className="text-[10px]">
                    {user?.displayName?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium truncate">{user?.displayName || 'You'}</span>
              </div>
              <div className="relative">
                <Textarea
                  ref={commentInputRef}
                  value={commentInputValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCommentInputValue(val);
                    const cursorPos = e.target.selectionStart;
                    const textUpToCursor = val.slice(0, cursorPos);
                    const atMatch = textUpToCursor.match(/@(\w*)$/);
                    if (atMatch && collaborators.length > 0) {
                      setInlineMentionOpen(true);
                      setInlineMentionQuery(atMatch[1]);
                      setInlineMentionStart(cursorPos - atMatch[0].length);
                    } else {
                      setInlineMentionOpen(false);
                    }
                  }}
                  placeholder="Comment or add others with @"
                  className="min-h-[60px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (inlineMentionOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab')) {
                      return;
                    }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleInlineCommentSubmit();
                    }
                    if (e.key === 'Escape') {
                      if (inlineMentionOpen) {
                        setInlineMentionOpen(false);
                      } else {
                        setPendingComment(null);
                        setCommentInputValue('');
                      }
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setInlineMentionOpen(false), 150);
                  }}
                />
                {inlineMentionOpen && (
                  <MentionDropdown
                    users={collaborators}
                    query={inlineMentionQuery}
                    visible={inlineMentionOpen}
                    position={{ top: 4, left: 0 }}
                    onSelect={(user) => {
                      const before = commentInputValue.slice(0, inlineMentionStart);
                      const after = commentInputValue.slice(inlineMentionStart + 1 + inlineMentionQuery.length);
                      const newVal = `${before}@${user.login} ${after}`;
                      setCommentInputValue(newVal);
                      setInlineMentionOpen(false);
                      setTimeout(() => {
                        const textarea = commentInputRef.current;
                        if (textarea) {
                          textarea.focus();
                          const pos = before.length + user.login.length + 2;
                          textarea.setSelectionRange(pos, pos);
                        }
                      }, 0);
                    }}
                    onClose={() => setInlineMentionOpen(false)}
                  />
                )}
              </div>
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
          onReopenComment={handleReopenComment}
          onAddReaction={handleAddReaction}
          onEditComment={handleEditComment}
          onDeleteComment={handleDeleteComment}
          activeCommentId={activeCommentId}
          onSelectComment={handleSelectComment}
          currentUserId={user?.uid}
          mentionUsers={collaborators}
        />
      </div>
    </div>
  );
}
