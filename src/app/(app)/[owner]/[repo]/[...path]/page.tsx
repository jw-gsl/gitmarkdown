'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams } from 'next/navigation';
import { MessageSquare, X, Send, Check, Sparkles } from 'lucide-react';
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
import { getLanguageForFile, isImageFile } from '@/lib/editor/file-utils';
import { CodeViewer } from '@/components/editor/code-viewer';
import { CodeToolbar } from '@/components/editor/code-toolbar';
import { ImageViewer } from '@/components/editor/image-viewer';
import { EditorBubbleMenu, type SelectionData } from '@/components/editor/bubble-menu';
import { InlineEditPanel } from '@/components/editor/inline-edit-panel';
import { PierreContentDiffView } from '@/components/diff/pierre-diff';
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

// Module-level cache: survives component remounts (e.g., navigating repo root → file → back)
const contentCache = new Map<string, { content: string; sha: string; name: string }>();
let hasLoadedOnce = false;

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
  const { createPR } = useGitHubPulls();
  const { collaborators, fetchCollaborators } = useGitHubCollaborators();
  const {
    createComment: createGHComment,
    replyToComment: replyToGHComment,
    updateComment: updateGHComment,
    deleteComment: deleteGHComment,
  } = useGitHubReviewComments();
  const { setCurrentFile, currentFile, markDirty, markClean, syncStatus, setOriginalContent, updateFileContent } = useFileStore();
  const { currentBranch, autoBranchName, setAutoBranchName, setCurrentBranch, setBranches, activePR, setActivePR } = useSyncStore();
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
    rightPanelOpen,
    rightPanelTab,
    setCommentSidebarOpen,
    setActiveCommentCount,
    setAIChatContext,
    setAISidebarOpen,
    pendingTextEdit,
    setPendingTextEdit,
    pushAIEditSnapshot,
    pendingAIDiff,
    resolvePendingAIDiff,
    focusMode,
    toggleFocusMode,
    setFocusMode,
  } = useUIStore();
  // Derive locally — Zustand getter properties break after first set() call (Object.assign evaluates them)
  const commentSidebarOpen = rightPanelOpen && rightPanelTab === 'comments';

  const [content, setContent] = useState<string>('');
  const [sha, setSha] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileLoading, setFileLoading] = useState(!hasLoadedOnce);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');

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
  const codeViewerContainerRef = useRef<HTMLDivElement>(null);
  const [codeEditSelection, setCodeEditSelection] = useState<SelectionData | null>(null);
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

    // Check if this file was created via a pending op (not yet pushed to GitHub)
    const pendingOps = useFileStore.getState().pendingOps;
    const pendingCreate = pendingOps.find(
      (op): op is Extract<typeof op, { type: 'create' }> => op.type === 'create' && op.path === filePath
    );
    if (pendingCreate) {
      const pendingContent = pendingCreate.content;
      const fileName = filePath.split('/').pop() ?? filePath;
      setContent(pendingContent);
      setCurrentFile({
        id: 'pending',
        path: filePath,
        name: fileName,
        type: 'file',
        sha: '',
        isMarkdown,
        content: pendingContent,
      });
      setIsDirty(true);
      markDirty(filePath);
      setFileLoading(false);
      hasLoadedOnce = true;
      return;
    }

    const cacheKey = `${owner}/${repo}:${currentBranch}:${filePath}`;
    const cached = contentCache.get(cacheKey);

    // If we have a cached version, show it immediately (no skeleton)
    if (cached) {
      setContent(cached.content);
      setSha(cached.sha);
      setOriginalContent(filePath, cached.content);
      setCurrentFile({
        id: cached.sha,
        path: filePath,
        name: cached.name,
        type: 'file',
        sha: cached.sha,
        isMarkdown,
        content: cached.content,
      });
      setIsDirty(false);
      setFileLoading(false);
      hasLoadedOnce = true;
    }

    const loadContent = async () => {
      // Only show loading skeleton when no cached version and first load
      if (!cached && !hasLoadedOnce) {
        setFileLoading(true);
      }
      try {
        const fileData = await fetchContent(owner, repo, filePath, currentBranch);
        if (fileData) {
          const decoded = fileData.encoding === 'base64'
            ? new TextDecoder().decode(Uint8Array.from(atob(fileData.content.replace(/\n/g, '')), c => c.charCodeAt(0)))
            : fileData.content;
          // Update cache
          contentCache.set(cacheKey, { content: decoded, sha: fileData.sha, name: fileData.name });
          setOriginalContent(filePath, decoded);
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
          hasLoadedOnce = true;
        }
      } catch (error) {
        // Only show error if we didn't already have cached content
        if (!cached) toast.error('Failed to load file');
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
      // Update content cache with saved version
      const cacheKey = `${owner}/${repo}:${targetBranch}:${filePath}`;
      contentCache.set(cacheKey, { content: contentRef.current, sha: result.sha, name: filePath.split('/').pop() || filePath });

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
      updateFileContent(filePath, newContent);
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
    [filePath, markDirty, updateFileContent, autoCommitDelay, handleSave, excludeBranches, currentBranch, filePattern]
  );

  // Comment handlers
  const handleCommentTrigger = useCallback(
    (data: { text: string; from: number; to: number }) => {
      setPendingComment(data);
      setCommentInputValue('');

      // Calculate vertical position relative to editor container
      const container = editorContainerRef.current;
      if (container) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
          // DOM selection (markdown editor or readonly code viewer)
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const scrollTop = container.scrollTop;
          const top = rect.top - containerRect.top + scrollTop;
          setCommentInputTop(Math.max(16, top));
        } else {
          // Textarea selection (code viewer editable mode) — use active element position
          const textarea = container.querySelector('textarea');
          if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
            const taRect = textarea.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const scrollTop = container.scrollTop;
            // Approximate vertical position based on selection start line
            const textBefore = textarea.value.substring(0, textarea.selectionStart);
            const lineNumber = textBefore.split('\n').length;
            const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
            const top = taRect.top - containerRect.top + scrollTop + lineNumber * lineHeight;
            setCommentInputTop(Math.max(16, top));
          }
        }
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

  // Code viewer inline edit handlers
  const handleCodeEditAccept = useCallback(
    (newText: string) => {
      if (!codeEditSelection) return;
      const c = content ?? '';
      const before = c.substring(0, codeEditSelection.from);
      const after = c.substring(codeEditSelection.to);
      handleContentChange(before + newText + after);
      setCodeEditSelection(null);
    },
    [codeEditSelection, content, handleContentChange]
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
            toast.warning('Comment saved locally but couldn\u2019t sync to GitHub. Try pulling latest changes.');
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
          }).catch(() => {
            toast.warning('Reply saved locally but couldn\u2019t sync to GitHub.');
          });
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
          // Markdown editor: ProseMirror mark
          const activeMark = container.querySelector('mark.comment-active');
          if (activeMark) {
            activeMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
          // Code viewer: the CodeViewer component auto-scrolls via activeAnchorText prop
          // (scroll is handled inside CodeViewer useEffect)
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

  // PR detection is now handled in layout.tsx (per-branch, not per-file)

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

  /** Read the current textarea selection in the code viewer */
  const getCodeSelection = useCallback((): SelectionData | null => {
    const container = codeViewerContainerRef.current;
    if (!container) return null;
    const textarea = container.querySelector('textarea');
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) return null;
    const text = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    return { text, from: textarea.selectionStart, to: textarea.selectionEnd };
  }, []);

  // Keyboard shortcut for save (Cmd+S / Ctrl+S) and focus mode (Cmd+.)
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
      // Cmd+. or Ctrl+. → Toggle focus mode
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        toggleFocusMode();
      }
      // Escape → Dismiss AI diff preview or exit focus mode
      if (e.key === 'Escape') {
        if (pendingAIDiff) {
          e.preventDefault();
          resolvePendingAIDiff(false);
        } else if (focusMode) {
          e.preventDefault();
          setFocusMode(false);
        }
      }

      // Code viewer shortcuts (only for non-markdown files)
      if (!isMarkdown && (e.metaKey || e.ctrlKey)) {
        // Cmd+E → Inline edit (always preventDefault to block Safari's "Use Selection for Find")
        if (e.key === 'e' && !e.shiftKey) {
          e.preventDefault();
          const sel = getCodeSelection();
          if (sel) {
            setCodeEditSelection(sel);
          }
        }
        // Cmd+J → Chat with selection
        if (e.key === 'j' && !e.shiftKey) {
          const sel = getCodeSelection();
          if (sel) {
            e.preventDefault();
            handleChatTrigger(sel);
          }
        }
        // Cmd+Shift+M → Comment on selection
        if (e.key === 'm' && e.shiftKey) {
          const sel = getCodeSelection();
          if (sel) {
            e.preventDefault();
            handleCommentTrigger(sel);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, handleSave, focusMode, toggleFocusMode, setFocusMode, isMarkdown, getCodeSelection, handleChatTrigger, handleCommentTrigger, pendingAIDiff, resolvePendingAIDiff]);

  // Apply text edits from AI sidebar tool calls
  useEffect(() => {
    if (!pendingTextEdit) return;
    const { oldText, newText } = pendingTextEdit;

    // Special case: revert all AI edits (replace entire content)
    if (oldText === '\x00REVERT_ALL') {
      setContent(newText);
      setIsDirty(true);
      markDirty(filePath);
      setPendingTextEdit(null);
      return;
    }

    // Find and replace in the current content with fallback strategies
    const currentContent = contentRef.current;
    let updated: string | null = null;

    if (currentContent.includes(oldText)) {
      // Exact match
      updated = currentContent.replace(oldText, newText);
    } else {
      // Fallback: try trimmed match (AI sometimes adds/removes trailing whitespace)
      const trimmedOld = oldText.trim();
      if (trimmedOld && currentContent.includes(trimmedOld)) {
        updated = currentContent.replace(trimmedOld, newText.trim());
      } else {
        // Fallback: normalize whitespace (collapse runs of spaces/tabs, keep newlines)
        const normalize = (s: string) => s.replace(/[^\S\n]+/g, ' ');
        const normalizedContent = normalize(currentContent);
        const normalizedOld = normalize(oldText);
        if (normalizedOld && normalizedContent.includes(normalizedOld)) {
          // Find the position in normalized content, then map back to original
          const idx = normalizedContent.indexOf(normalizedOld);
          // Walk original content to find the matching range
          let origStart = 0, normIdx = 0;
          for (; normIdx < idx && origStart < currentContent.length; origStart++) {
            if (normalize(currentContent.slice(origStart, origStart + 1)) === '') continue;
            normIdx++;
          }
          // Find end by matching normalized length
          let origEnd = origStart;
          let matchLen = 0;
          while (matchLen < normalizedOld.length && origEnd < currentContent.length) {
            origEnd++;
            matchLen = normalize(currentContent.slice(origStart, origEnd)).length;
          }
          updated = currentContent.slice(0, origStart) + newText + currentContent.slice(origEnd);
        }
      }
    }

    if (updated !== null) {
      // Snapshot current content before applying AI edit (for one-click rollback)
      pushAIEditSnapshot({ content: currentContent, filePath, timestamp: Date.now() });
      setContent(updated);
      setIsDirty(true);
      markDirty(filePath);
      toast.success('Edit applied');
    } else {
      toast.error('Could not find the text to replace');
    }

    setPendingTextEdit(null);
  }, [pendingTextEdit, setPendingTextEdit, filePath, markDirty, pushAIEditSnapshot]);

  const activeCommentCount = comments.filter(
    (c) => !c.parentCommentId && c.status === 'active'
  ).length;

  // Collect anchor texts for highlighting in the editor
  // Include pendingComment text so the highlight appears while the comment input is open
  const commentAnchors = useMemo(
    () => {
      const anchors = comments
        .filter((c) => !c.parentCommentId && c.status === 'active' && c.anchorText)
        .map((c) => c.anchorText);
      if (pendingComment?.text && !anchors.includes(pendingComment.text)) {
        anchors.push(pendingComment.text);
      }
      return anchors;
    },
    [comments, pendingComment]
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
    <div className="flex h-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "DigitalDocument",
            "name": currentFile?.name || "Untitled",
            "encodingFormat": "text/markdown",
            "isPartOf": {
              "@type": "SoftwareSourceCode",
              "codeRepository": `https://github.com/${owner}/${repo}`,
              "name": `${owner}/${repo}`
            }
          })
        }}
      />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <EditorHeader
          isDirty={isDirty}
          autoSaveStatus={autoSaveStatus}
        />

        {/* Main editor area */}
        <div ref={editorContainerRef} className="relative flex-1 overflow-auto bg-accent/40 dark:bg-background">
          {diffViewCommitSha ? (
            <CommitDiffView owner={owner} repo={repo} filePath={filePath} />
          ) : (
            <>
              {isMarkdown ? (
                fileLoading ? (
                  <div className="min-h-full bg-accent/40 dark:bg-background">
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
                <div className="min-h-full bg-accent/40 dark:bg-background">
                  <div className="mx-auto max-w-3xl min-h-[calc(100vh-8rem)] bg-background editor-page rounded-lg overflow-hidden flex flex-col">
                    {fileLoading ? (
                      <div className="p-6 space-y-3">
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                      </div>
                    ) : isImageFile(filePath) ? (
                      <ImageViewer
                        src={`https://raw.githubusercontent.com/${owner}/${repo}/${currentBranch}/${filePath}`}
                        filename={filePath}
                      />
                    ) : (
                      <>
                        <CodeToolbar
                          filename={filePath}
                          content={content ?? ''}
                          language={getLanguageForFile(filePath)}
                          lineCount={(content ?? '').split('\n').length}
                          onUndo={() => document.execCommand('undo')}
                          onRedo={() => document.execCommand('redo')}
                        />
                        <div ref={codeViewerContainerRef} className="flex-1">
                          <CodeViewer
                            content={content ?? ''}
                            filename={filePath}
                            onChange={handleContentChange}
                            commentAnchors={commentAnchors}
                            activeAnchorText={activeAnchorText}
                            onHighlightClick={handleHighlightClick}
                          />
                        </div>
                        <EditorBubbleMenu
                          containerRef={codeViewerContainerRef}
                          onEdit={(data) => setCodeEditSelection(data)}
                          onChat={handleChatTrigger}
                          onComment={handleCommentTrigger}
                        />
                        {codeEditSelection && (
                          <InlineEditPanel
                            selectedText={codeEditSelection.text}
                            selectionFrom={codeEditSelection.from}
                            selectionTo={codeEditSelection.to}
                            context={content ?? ''}
                            onAccept={handleCodeEditAccept}
                            onReject={() => setCodeEditSelection(null)}
                            onClose={() => setCodeEditSelection(null)}
                            filename={filePath}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Floating AI diff panel — shows proposed edit for review before applying */}
          {pendingAIDiff && (
            <div className="absolute inset-x-0 bottom-0 z-40 flex justify-center p-4 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-2xl rounded-xl border bg-background shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200">
                <div className="flex items-center justify-between border-b px-4 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="size-3.5 text-primary" />
                    AI Edit Preview
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => resolvePendingAIDiff(false)}
                    aria-label="Dismiss AI edit preview"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <div className="max-h-[40vh] overflow-auto">
                  <PierreContentDiffView
                    oldContent={pendingAIDiff.oldText}
                    newContent={pendingAIDiff.newText}
                    viewMode="unified"
                  />
                </div>
                <div className="flex justify-end gap-2 border-t px-4 py-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resolvePendingAIDiff(false)}
                    className="h-7 text-xs px-3"
                  >
                    <X className="h-3 w-3 mr-1.5" />
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => resolvePendingAIDiff(true)}
                    className="h-7 text-xs px-3"
                  >
                    <Check className="h-3 w-3 mr-1.5" />
                    Apply
                  </Button>
                </div>
              </div>
            </div>
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
      </div>

      {/* Comment sidebar — portaled into the unified right panel's comments slot */}
      <CommentPortal
        isVisible={commentSidebarOpen && !focusMode}
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
        onClose={() => setCommentSidebarOpen(false)}
      />
    </div>
  );
}

/** Portals the CommentSidebar into the right panel's comments slot */
function CommentPortal({
  isVisible,
  onClose,
  ...commentProps
}: {
  isVisible: boolean;
  onClose: () => void;
} & Omit<React.ComponentProps<typeof CommentSidebar>, 'isOpen' | 'onClose'>) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (isVisible) {
      // Slot is always mounted (uses hidden class when inactive), so it's always in the DOM
      const el = document.querySelector('[data-testid="right-panel-comments-slot"]') as HTMLElement | null;
      setPortalTarget(el);
    } else {
      setPortalTarget(null);
    }
  }, [isVisible]);

  if (!portalTarget) return null;

  return createPortal(
    <CommentSidebar
      isOpen={true}
      onClose={onClose}
      {...commentProps}
    />,
    portalTarget
  );
}
