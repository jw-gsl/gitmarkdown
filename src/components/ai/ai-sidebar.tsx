'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, getToolName, type DynamicToolUIPart } from 'ai';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import {
  ArrowUp, ArrowLeft, X, Sparkles, Loader2, FileText, AlertCircle, Wrench, Check,
  History, Plus, Trash2, Mic, MicOff, RotateCcw, Search, Globe, Link, FolderOpen,
  GitBranch, Users, Pencil, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  EditToolDiff, WriteFileDiff, CreateFilePreview, RenameFilePreview,
  DeleteFilePreview, SuggestResponsesView, ToolResultDisplay,
  CommitProposal, CreateBranchProposal,
  AIMessageAvatar, UserMessageAvatar,
} from '@/components/ai/chat-message';
import { PersonaSelector, useActivePersona } from '@/components/ai/persona-selector';
import { AIProviderSelect } from './ai-provider-select';
import {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextInputUsage,
  ContextOutputUsage,
  ContextContentFooter,
} from '@/components/ai-elements/context';
import { useSettingsStore } from '@/stores/settings-store';
import { useFileStore } from '@/stores/file-store';
import { useSyncStore } from '@/stores/sync-store';
import { useUIStore } from '@/stores/ui-store';
import { useGitHubContent } from '@/hooks/use-github';
import { useAuth } from '@/providers/auth-provider';
import {
  createAIChat, updateAIChat, getAIChats, deleteAIChat,
  type AIChat,
} from '@/lib/firebase/firestore';
import type { FileNode } from '@/types';
import { toast } from 'sonner';

/** Mentioned file with fetched content */
interface MentionedFile {
  path: string;
  name: string;
  content: string;
}

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Error boundary around the messages area — catches rendering crashes without losing chat state */
class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center gap-3">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Failed to render messages</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Recursively flatten a FileNode tree into a flat list of files (no directories). */
function flattenFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === 'file') {
      result.push(node);
    }
    if (node.children) {
      result.push(...flattenFiles(node.children));
    }
  }
  return result;
}

/** Rough token estimate (~4 chars per token) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Model context window sizes */
const MODEL_MAX_TOKENS: Record<string, number> = {
  'claude-sonnet-4-20250514': 200000,
  'claude-haiku-4-5-20251001': 200000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
};

export function AISidebar({ isOpen, onClose }: AISidebarProps) {
  const params = useParams();
  const router = useRouter();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const { user } = useAuth();
  const { aiProvider, aiModel } = useSettingsStore();
  const activePersona = useActivePersona();
  const { currentFile, files, addPendingOp, applyOpToTree } = useFileStore();
  const { currentBranch, baseBranch } = useSyncStore();
  const { fetchContent } = useGitHubContent();

  /** Navigate to a file path in the editor */
  const navigateToFile = useCallback(
    (path: string) => {
      const base = `/${owner}/${repo}/${path}`;
      const url = currentBranch && currentBranch !== baseBranch
        ? `${base}?branch=${encodeURIComponent(currentBranch)}`
        : base;
      router.push(url);
    },
    [owner, repo, currentBranch, baseBranch, router]
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [mentionedFiles, setMentionedFiles] = useState<MentionedFile[]>([]);
  const [excludeCurrentFile, setExcludeCurrentFile] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toolCallStatuses, setToolCallStatuses] = useState<Record<string, 'accepted' | 'rejected'>>({});
  /** Tracks which tool call is currently being previewed in the editor diff */
  const pendingDiffToolCallRef = useRef<{ toolCallId: string; oldText: string; newText: string; isFullRewrite: boolean } | null>(null);
  const aiChatContext = useUIStore((s) => s.aiChatContext);
  const setAIChatContext = useUIStore((s) => s.setAIChatContext);
  const setPendingTextEdit = useUIStore((s) => s.setPendingTextEdit);
  const setPendingAIDiff = useUIStore((s) => s.setPendingAIDiff);
  const pendingAIDiffResolved = useUIStore((s) => s.pendingAIDiffResolved);
  const clearPendingAIDiffResolved = useUIStore((s) => s.clearPendingAIDiffResolved);
  const aiEditSnapshots = useUIStore((s) => s.aiEditSnapshots);
  const popAIEditSnapshot = useUIStore((s) => s.popAIEditSnapshot);
  const clearAIEditSnapshots = useUIStore((s) => s.clearAIEditSnapshots);

  // ── Chat history state ─────────────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);
  const [chatList, setChatList] = useState<AIChat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const titleGenerated = useRef(false);
  const prevStatus = useRef<string>('ready');

  // ── Speech recognition state ───────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Get all files from the file tree (not just markdown)
  const allFiles = useMemo(() => {
    return flattenFiles(files);
  }, [files]);

  // Filter files based on mention query
  const filteredMentionFiles = useMemo(() => {
    if (!mentionQuery) return allFiles;
    const q = mentionQuery.toLowerCase();
    return allFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.path.toLowerCase().includes(q)
    );
  }, [allFiles, mentionQuery]);

  // Reset exclusion when switching files
  const currentFilePath = currentFile?.path;
  useEffect(() => { setExcludeCurrentFile(false); }, [currentFilePath]);

  // Build file context string from mentioned files + current file
  const fileContextString = useMemo(() => {
    const parts: string[] = [];
    if (currentFile?.content && !excludeCurrentFile) {
      parts.push(`Current file (${currentFile.path}):\n\n${currentFile.content}`);
    }
    for (const mf of mentionedFiles) {
      if (mf.content && mf.path !== currentFile?.path) {
        parts.push(`Referenced file (${mf.path}):\n\n${mf.content}`);
      }
    }
    return parts.length > 0 ? parts.join('\n\n---\n\n') : undefined;
  }, [currentFile, mentionedFiles, excludeCurrentFile]);

  const suggestions = useMemo(() => {
    if (!currentFile) return ['Write a blog post', 'Create a README', 'Generate a table of contents'];
    if (currentFile.isMarkdown) {
      return [
        `Summarize ${currentFile.name}`,
        'Improve the writing',
        'Fix grammar and spelling',
        'Add more detail',
      ];
    }
    return [
      `Explain ${currentFile.name}`,
      'Find potential bugs',
      'Add error handling',
      'Refactor this file',
    ];
  }, [currentFile]);

  // Build a compact file tree string for AI context
  const fileTreeString = useMemo(() => {
    const lines: string[] = [];
    const walk = (nodes: FileNode[], indent: string) => {
      for (const n of nodes) {
        lines.push(`${indent}${n.type === 'directory' ? n.name + '/' : n.name}`);
        if (n.children && lines.length < 200) walk(n.children, indent + '  ');
      }
    };
    walk(files, '');
    if (lines.length === 0) return undefined;
    if (lines.length > 200) return lines.slice(0, 200).join('\n') + '\n...(truncated)';
    return lines.join('\n');
  }, [files]);

  // Use a ref for the transport body so that changing file content or persona
  // doesn't recreate the transport and reset useChat's message state.
  const transportBodyRef = useRef({
    provider: aiProvider,
    modelId: aiModel,
    fileContext: fileContextString,
    personaInstructions: activePersona.instructions || undefined,
    personaName: activePersona.name,
    owner,
    repo,
    branch: currentBranch,
    fileTree: fileTreeString,
  });
  transportBodyRef.current = {
    provider: aiProvider,
    modelId: aiModel,
    fileContext: fileContextString,
    personaInstructions: activePersona.instructions || undefined,
    personaName: activePersona.name,
    owner,
    repo,
    branch: currentBranch,
    fileTree: fileTreeString,
  };

  // Keep a ref to the user for async header resolution
  const userRef = useRef(user);
  userRef.current = user;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/chat',
        headers: async (): Promise<Record<string, string>> => {
          const idToken = await userRef.current?.getIdToken();
          return idToken ? { Authorization: `Bearer ${idToken}` } : {};
        },
        body: () => transportBodyRef.current,
      }),
    []
  );

  const { messages, sendMessage, status, setMessages, error } = useChat({
    transport,
    onError: (err) => {
      try {
        const parsed = JSON.parse(err.message);
        setErrorMessage(parsed.error || err.message);
      } catch {
        setErrorMessage(err.message);
      }
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // Estimate token usage from messages
  const tokenUsage = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    for (const msg of messages) {
      const text = msg.parts
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('') || '';
      if (msg.role === 'user') {
        inputTokens += estimateTokens(text);
      } else {
        outputTokens += estimateTokens(text);
      }
    }
    // Add file context to input estimate
    if (fileContextString) {
      inputTokens += estimateTokens(fileContextString);
    }
    return { inputTokens, outputTokens, total: inputTokens + outputTokens };
  }, [messages, fileContextString]);

  const maxTokens = MODEL_MAX_TOKENS[aiModel] || 128000;

  // Show error from useChat hook
  useEffect(() => {
    if (error) {
      try {
        const parsed = JSON.parse(error.message);
        setErrorMessage(parsed.error || error.message);
      } catch {
        setErrorMessage(error.message);
      }
    }
  }, [error]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // When chat context is set from the editor (user clicked "Chat" in bubble menu),
  // pre-fill the input with context and focus the textarea
  useEffect(() => {
    if (aiChatContext && isOpen) {
      const contextMessage = `Regarding this text:\n\n"${aiChatContext}"\n\n`;
      setInput(contextMessage);
      setAIChatContext(null);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(contextMessage.length, contextMessage.length);
        }
      }, 100);
    }
  }, [aiChatContext, isOpen, setAIChatContext]);

  // Close mention dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(e.target as Node)
      ) {
        setShowMentionDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Chat history: load list ────────────────────────────────────────
  const loadChatList = useCallback(async () => {
    if (!user) return;
    setLoadingChats(true);
    try {
      const chats = await getAIChats(user.uid);
      const repoChats = chats.filter((c) => c.repoFullName === `${owner}/${repo}`);
      setChatList(repoChats);
    } catch (err) {
      console.error('[AI Chat] Failed to load chat list:', err);
    } finally {
      setLoadingChats(false);
    }
  }, [user, owner, repo]);

  // Load chat list when opening history
  useEffect(() => {
    if (showHistory && user) loadChatList();
  }, [showHistory, user, loadChatList]);

  // ── Chat history: save current chat ────────────────────────────────
  // Use refs for frequently-changing values to keep saveChat stable
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const currentChatIdRef = useRef(currentChatId);
  currentChatIdRef.current = currentChatId;

  const saveChat = useCallback(async () => {
    const msgs = messagesRef.current;
    const chatId = currentChatIdRef.current;
    if (!user || msgs.length === 0) return;
    try {
      const serialized = JSON.stringify(msgs);
      if (chatId) {
        await updateAIChat(user.uid, chatId, { messages: serialized });
      } else {
        const id = await createAIChat(user.uid, {
          repoFullName: `${owner}/${repo}`,
          title: 'New Chat',
          messages: serialized,
        });
        // Update ref immediately to prevent duplicate creates from concurrent calls
        currentChatIdRef.current = id;
        setCurrentChatId(id);
        // Generate title from first user message
        if (!titleGenerated.current) {
          titleGenerated.current = true;
          const firstUserMsg = msgs.find((m) => m.role === 'user');
          if (firstUserMsg) {
            const textPart = firstUserMsg.parts?.find((p) => p.type === 'text') as { type: 'text'; text: string } | undefined;
            const text = textPart?.text || (firstUserMsg as any).content || '';
            if (text) {
              try {
                const res = await fetch('/api/ai/title', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: text }),
                });
                const { title } = await res.json();
                if (title && title !== 'New Chat') {
                  await updateAIChat(user.uid, id, { title });
                }
              } catch {
                // ignore
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[AI Chat] Failed to save chat:', err);
    }
  }, [user, owner, repo]);

  // Handle resolution of a pending AI diff shown in the editor
  useEffect(() => {
    if (pendingAIDiffResolved === null) return;
    const pending = pendingDiffToolCallRef.current;
    if (!pending) {
      clearPendingAIDiffResolved();
      return;
    }
    if (pendingAIDiffResolved) {
      // User accepted from the editor — apply the edit
      if (pending.isFullRewrite) {
        setPendingTextEdit({ oldText: '\x00REVERT_ALL', newText: pending.newText });
      } else {
        setPendingTextEdit({ oldText: pending.oldText, newText: pending.newText });
      }
      setToolCallStatuses((prev) => ({ ...prev, [pending.toolCallId]: 'accepted' }));
    } else {
      // User rejected from the editor
      setToolCallStatuses((prev) => ({ ...prev, [pending.toolCallId]: 'rejected' }));
    }
    pendingDiffToolCallRef.current = null;
    clearPendingAIDiffResolved();
  }, [pendingAIDiffResolved, clearPendingAIDiffResolved, setPendingTextEdit]);

  // Auto-save when AI finishes responding or after an error
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;
    if (messages.length === 0) return;
    // Save when transitioning to ready/error from any active state
    if ((status === 'ready' || status === 'error') && (prev === 'streaming' || prev === 'submitted')) {
      saveChat();
    }
  }, [status, messages.length, saveChat]);

  // ── Chat history: new / load / delete ──────────────────────────────
  const startNewChat = useCallback(async () => {
    // Save the current chat before starting a new one
    if (messages.length > 0) {
      await saveChat();
    }
    setMessages([]);
    setCurrentChatId(null);
    titleGenerated.current = false;
    setErrorMessage(null);
    setMentionedFiles([]);
    setToolCallStatuses({});
    setShowHistory(false);
  }, [setMessages, messages.length, saveChat]);

  const loadChat = useCallback(
    (chat: AIChat) => {
      try {
        const parsed = JSON.parse(chat.messages, (key, value) => {
          if (key === 'createdAt' && typeof value === 'string') return new Date(value);
          return value;
        });
        setMessages(parsed);
        setCurrentChatId(chat.id);
        titleGenerated.current = true;
        setShowHistory(false);
        setErrorMessage(null);
        setMentionedFiles([]);
        setToolCallStatuses({});
      } catch {
        toast.error('Failed to load chat');
      }
    },
    [setMessages]
  );

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      if (!user) return;
      try {
        await deleteAIChat(user.uid, chatId);
        setChatList((prev) => prev.filter((c) => c.id !== chatId));
        if (currentChatId === chatId) {
          setMessages([]);
          setCurrentChatId(null);
          titleGenerated.current = false;
        }
      } catch {
        toast.error('Failed to delete chat');
      }
    },
    [user, currentChatId, setMessages]
  );

  const handleRenameChat = useCallback(
    async (chatId: string, newTitle: string) => {
      if (!user || !newTitle.trim()) return;
      try {
        await updateAIChat(user.uid, chatId, { title: newTitle.trim() });
        setChatList((prev) => prev.map((c) => c.id === chatId ? { ...c, title: newTitle.trim() } : c));
      } catch {
        toast.error('Failed to rename chat');
      }
      setRenamingChatId(null);
    },
    [user]
  );

  const handleDuplicateChat = useCallback(
    async (chat: AIChat) => {
      if (!user) return;
      try {
        const id = await createAIChat(user.uid, {
          repoFullName: chat.repoFullName,
          title: `${chat.title} (copy)`,
          messages: chat.messages,
        });
        setChatList((prev) => [{ ...chat, id, title: `${chat.title} (copy)`, createdAt: new Date(), updatedAt: new Date() }, ...prev]);
        toast.success('Chat duplicated');
      } catch {
        toast.error('Failed to duplicate chat');
      }
    },
    [user]
  );

  // Filtered chat list based on search
  const filteredChatList = useMemo(() => {
    if (!historySearch.trim()) return chatList;
    const q = historySearch.toLowerCase();
    return chatList.filter((c) => c.title.toLowerCase().includes(q));
  }, [chatList, historySearch]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingChatId) renameInputRef.current?.focus();
  }, [renamingChatId]);

  // ── Speech recognition ─────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  // ── Mention handling ───────────────────────────────────────────────
  const handleMentionSelect = useCallback(
    async (file: FileNode) => {
      const before = input.slice(0, mentionStartIndex);
      const after = input.slice(textareaRef.current?.selectionStart ?? input.length);
      setInput(`${before}${after}`);

      setShowMentionDropdown(false);
      setMentionQuery('');
      setMentionStartIndex(-1);
      setSelectedMentionIndex(0);

      if (mentionedFiles.find((f) => f.path === file.path)) {
        setTimeout(() => textareaRef.current?.focus(), 0);
        return;
      }

      try {
        const fileData = await fetchContent(owner, repo, file.path, currentBranch);
        if (fileData) {
          const decoded =
            fileData.encoding === 'base64'
              ? new TextDecoder().decode(
                  Uint8Array.from(atob(fileData.content.replace(/\n/g, '')), (c) =>
                    c.charCodeAt(0)
                  )
                )
              : fileData.content;
          setMentionedFiles((prev) => [
            ...prev,
            { path: file.path, name: file.name, content: decoded },
          ]);
        }
      } catch {
        setMentionedFiles((prev) => [
          ...prev,
          { path: file.path, name: file.name, content: '' },
        ]);
      }

      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [input, mentionStartIndex, mentionedFiles, fetchContent, owner, repo, currentBranch]
  );

  const removeMentionedFile = useCallback((filePath: string) => {
    setMentionedFiles((prev) => prev.filter((f) => f.path !== filePath));
  }, []);

  const openMentionPicker = useCallback(() => {
    setInput((prev) => prev + '@');
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const pos = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(pos, pos);
        setShowMentionDropdown(true);
        setMentionQuery('');
        setMentionStartIndex(pos - 1);
        setSelectedMentionIndex(0);
      }
    }, 0);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInput(value);

      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        const textBetween = textBeforeCursor.slice(lastAtIndex + 1);
        const charBeforeAt = lastAtIndex > 0 ? value[lastAtIndex - 1] : ' ';
        if (!textBetween.includes(' ') && (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0)) {
          setShowMentionDropdown(true);
          setMentionQuery(textBetween);
          setMentionStartIndex(lastAtIndex);
          setSelectedMentionIndex(0);
          return;
        }
      }

      setShowMentionDropdown(false);
      setMentionQuery('');
    },
    []
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      setErrorMessage(null);
      sendMessage({ text: input });
      setInput('');
      // Save after a short delay so the message array has the new user message
      setTimeout(() => saveChat(), 500);
    },
    [input, isLoading, sendMessage, saveChat]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showMentionDropdown && filteredMentionFiles.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedMentionIndex((prev) =>
            prev < filteredMentionFiles.length - 1 ? prev + 1 : 0
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedMentionIndex((prev) =>
            prev > 0 ? prev - 1 : filteredMentionFiles.length - 1
          );
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          handleMentionSelect(filteredMentionFiles[selectedMentionIndex]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowMentionDropdown(false);
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    },
    [showMentionDropdown, filteredMentionFiles, selectedMentionIndex, handleMentionSelect, handleSubmit]
  );

  const dismissError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  /** Collect pending tool call IDs (editFile, writeFile, createFile) for a given message */
  const getPendingEditIds = useCallback(
    (message: (typeof messages)[number]) => {
      if (message.role !== 'assistant' || !message.parts) return [];
      return message.parts
        .map((part, i) => {
          if (!isToolUIPart(part)) return null;
          const toolPart = part as DynamicToolUIPart;
          const toolName = getToolName(toolPart);
          if (!['editFile', 'writeFile', 'createFile', 'renameFile', 'deleteFile', 'commitChanges', 'createBranch'].includes(toolName ?? '')) return null;
          if (toolPart.state !== 'output-available' && toolPart.state !== 'input-available') return null;
          const toolCallId = toolPart.toolCallId ?? `${message.id}-${i}`;
          if (toolCallStatuses[toolCallId]) return null;
          return { toolCallId, toolName, input: toolPart.input as Record<string, string> | undefined };
        })
        .filter(Boolean) as { toolCallId: string; toolName: string; input: Record<string, string> | undefined }[];
    },
    [toolCallStatuses]
  );

  const handleAcceptAll = useCallback(
    (message: (typeof messages)[number]) => {
      const pending = getPendingEditIds(message);
      for (const { toolCallId, toolName, input: toolInput } of pending) {
        if (toolInput) {
          if (toolName === 'editFile') {
            setPendingTextEdit({ oldText: toolInput.oldText ?? '', newText: toolInput.newText ?? '' });
          } else if (toolName === 'writeFile') {
            setPendingTextEdit({ oldText: '\x00REVERT_ALL', newText: toolInput.content ?? '' });
          } else if (toolName === 'createFile') {
            const filePath = toolInput.path ?? '';
            const op = { type: 'create' as const, path: filePath, content: toolInput.content ?? '' };
            addPendingOp(op);
            applyOpToTree(op);
            if (filePath) navigateToFile(filePath);
          } else if (toolName === 'renameFile') {
            const op = { type: 'rename' as const, oldPath: toolInput.oldPath ?? '', newPath: toolInput.newPath ?? '', sha: '', content: '' };
            addPendingOp(op);
            applyOpToTree(op);
          } else if (toolName === 'deleteFile') {
            const op = { type: 'delete' as const, path: toolInput.path ?? '', sha: '' };
            addPendingOp(op);
            applyOpToTree(op);
          }
        }
        setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'accepted' }));
      }
    },
    [getPendingEditIds, setPendingTextEdit, addPendingOp, applyOpToTree, navigateToFile]
  );

  const handleRejectAll = useCallback(
    (message: (typeof messages)[number]) => {
      const pending = getPendingEditIds(message);
      for (const { toolCallId } of pending) {
        setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'rejected' }));
      }
    },
    [getPendingEditIds]
  );

  /** Revert all AI edits by restoring the first snapshot */
  const handleRevertAll = useCallback(() => {
    const snapshots = aiEditSnapshots;
    if (snapshots.length === 0) return;
    // Restore the oldest snapshot (pre-AI state)
    const oldest = snapshots[0];
    setPendingTextEdit({ oldText: '', newText: '' }); // Clear any pending
    // Set all tool calls to rejected
    setToolCallStatuses((prev) => {
      const updated = { ...prev };
      for (const key of Object.keys(updated)) {
        if (updated[key] === 'accepted') {
          updated[key] = 'rejected';
        }
      }
      return updated;
    });
    // Apply rollback via a special "replace everything" edit
    // We use the current content as oldText and the snapshot content as newText
    // But since we don't know current content here, we use the store mechanism
    setPendingTextEdit({ oldText: '\x00REVERT_ALL', newText: oldest.content });
    clearAIEditSnapshots();
    toast.success('Reverted all AI edits');
  }, [aiEditSnapshots, setPendingTextEdit, clearAIEditSnapshots]);

  // Extra mentioned files (not the current file)
  const extraMentionedFiles = mentionedFiles.filter((f) => f.path !== currentFile?.path);

  return (
    <aside data-testid="ai-sidebar" aria-label="AI Assistant" className="flex h-full w-full flex-col bg-background">
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center border-b px-1 py-0.5">
          {showHistory ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Back to chat"
                    className="h-8 w-8"
                    onClick={() => { setShowHistory(false); setHistorySearch(''); setRenamingChatId(null); }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Back to chat</p></TooltipContent>
              </Tooltip>
              <span className="text-sm font-medium flex-1">Chat History</span>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="ai-history-button"
                    aria-label="Chat history"
                    className="h-8 w-8"
                    onClick={() => { setShowHistory(true); setConfirmDeleteId(null); }}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Chat history</p></TooltipContent>
              </Tooltip>
              <div className="flex-1 min-w-0">
                <PersonaSelector />
              </div>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="ai-new-chat" aria-label="New chat" className="h-8 w-8" onClick={startNewChat}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p className="text-xs">New chat</p></TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* ── History panel ───────────────────────────────────────────── */}
      {showHistory ? (
        <div className="flex flex-1 min-h-0 flex-col">
          {/* Search bar */}
          <div className="px-3 pt-2 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 pt-1 space-y-0.5">
              {loadingChats ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredChatList.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">
                  {historySearch ? 'No matching chats' : 'No previous chats'}
                </p>
              ) : (
                filteredChatList.map((chat) => (
                  <ContextMenu key={chat.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        className={`group flex items-center justify-between rounded-md px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors ${
                          chat.id === currentChatId ? 'bg-accent' : ''
                        }`}
                        onClick={() => { if (renamingChatId !== chat.id) loadChat(chat); }}
                      >
                        <div className="min-w-0 flex-1">
                          {renamingChatId === chat.id ? (
                            <Input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameChat(chat.id, renameValue);
                                if (e.key === 'Escape') setRenamingChatId(null);
                              }}
                              onBlur={() => handleRenameChat(chat.id, renameValue)}
                              className="h-6 text-sm font-medium px-1"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p className="text-sm font-medium truncate">{chat.title}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {chat.updatedAt.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onClick={() => {
                          setRenamingChatId(chat.id);
                          setRenameValue(chat.title);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleDuplicateChat(chat)}>
                        <Copy className="h-4 w-4" />
                        Duplicate
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleDeleteChat(chat.id)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <>
          {messages.length === 0 && !errorMessage ? (
            /* ── Empty state — pushed toward input ──────────────────── */
            <div className="flex-1 flex flex-col justify-end px-3 pb-3 min-h-0">
              <div className="text-center mb-6">
                <Sparkles className="mb-3 h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">How can I help?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Type <kbd className="rounded border bg-muted px-1 py-0.5 text-xs">@</kbd> to mention a file for context.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    data-testid="ai-suggestion"
                    aria-label={`Send suggested prompt: ${s}`}
                    onClick={() => sendMessage({ text: s })}
                    className="rounded-full border bg-background px-2.5 py-1 text-xs text-left hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
          <>
          {/* ── Messages area ─────────────────────────────────────────── */}
          <ChatErrorBoundary>
          <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollRef} data-testid="ai-messages" role="log" aria-live="polite" aria-relevant="additions">
            <div className="space-y-4">
              {messages.map((message, msgIdx) => (
                <div
                  key={message.id}
                  className={`min-w-0 ${message.role === 'user' ? 'flex justify-end gap-2.5' : 'flex gap-2.5 overflow-hidden'}`}
                >
                  {message.role === 'assistant' && (
                    <AIMessageAvatar avatar={activePersona.avatar} />
                  )}
                  <div
                    className={`rounded-lg py-2 text-sm min-w-0 ${
                      message.role === 'user'
                        ? 'px-3 overflow-hidden break-words bg-primary text-primary-foreground max-w-[85%]'
                        : 'px-2 overflow-hidden break-words flex-1 min-w-0 bg-muted'
                    }`}
                    style={{ overflowWrap: 'anywhere' }}
                  >
                    {/* Reorder assistant parts: text first, then tool calls (so text appears above diffs) */}
                    {(message.role === 'assistant'
                      ? [...(message.parts ?? [])].sort((a, b) => {
                          const aIsText = a.type === 'text' ? 0 : 1;
                          const bIsText = b.type === 'text' ? 0 : 1;
                          return aIsText - bIsText;
                        })
                      : message.parts ?? []
                    ).map((part, i) => {
                      if (part.type === 'text') {
                        const textContent = (part as { type: 'text'; text: string }).text;
                        if (!textContent) return null;
                        if (message.role === 'assistant') {
                          const isLastAssistant = isLoading && msgIdx === messages.length - 1;
                          return (
                            <div key={i} className="max-w-full min-w-0 break-words overflow-hidden text-sm">
                              <Streamdown
                                plugins={{ code }}
                                isAnimating={isLastAssistant}
                                caret={isLastAssistant ? 'block' : undefined}
                              >
                                {textContent}
                              </Streamdown>
                            </div>
                          );
                        }
                        // For user messages, render @mentions as inline badges
                        const text = textContent;
                        const mentionRegex = /@([\w\-_.]+\.\w+)/g;
                        const segments: React.ReactNode[] = [];
                        let lastIndex = 0;
                        let match;
                        while ((match = mentionRegex.exec(text)) !== null) {
                          if (match.index > lastIndex) {
                            segments.push(text.slice(lastIndex, match.index));
                          }
                          segments.push(
                            <span key={match.index} className="inline-flex items-center gap-0.5 rounded bg-primary-foreground/20 px-1 py-0.5 text-xs font-medium">
                              <FileText className="h-3 w-3" />
                              {match[1]}
                            </span>
                          );
                          lastIndex = match.index + match[0].length;
                        }
                        if (lastIndex < text.length) {
                          segments.push(text.slice(lastIndex));
                        }
                        return <span key={i}>{segments.length > 0 ? segments : text}</span>;
                      }
                      // Handle tool parts (both static `tool-editFile` and dynamic `dynamic-tool`)
                      if (isToolUIPart(part)) {
                        const toolPart = part as DynamicToolUIPart;
                        const toolName = getToolName(toolPart);
                        const toolInput = toolPart.input as Record<string, string> | undefined;
                        const toolCallId = toolPart.toolCallId ?? `${message.id}-${i}`;
                        const toolCallStatus = toolCallStatuses[toolCallId];

                        if (toolName === 'editFile' && toolInput) {
                          // Show diff once input is available (input-available or output-available)
                          if (toolPart.state === 'output-available' || toolPart.state === 'input-available') {
                            return (
                              <div key={i} className="my-2 overflow-hidden max-w-full min-w-0">
                                <EditToolDiff
                                  oldText={toolInput.oldText ?? ''}
                                  newText={toolInput.newText ?? ''}
                                  status={toolCallStatus ?? 'pending'}
                                  onAccept={(editedText) => {
                                    // Show diff in editor area for review
                                    pendingDiffToolCallRef.current = { toolCallId, oldText: toolInput.oldText ?? '', newText: editedText, isFullRewrite: false };
                                    setPendingAIDiff({ oldText: toolInput.oldText ?? '', newText: editedText, isFullRewrite: false });
                                  }}
                                  onReject={() => {
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'rejected' }));
                                  }}
                                  onRestore={() => {
                                    pendingDiffToolCallRef.current = { toolCallId, oldText: toolInput.oldText ?? '', newText: toolInput.newText ?? '', isFullRewrite: false };
                                    setPendingAIDiff({ oldText: toolInput.oldText ?? '', newText: toolInput.newText ?? '', isFullRewrite: false });
                                  }}
                                />
                              </div>
                            );
                          }
                          return (
                            <p key={i} className="my-2 text-xs text-muted-foreground animate-pulse">Editing document...</p>
                          );
                        }

                        if (toolName === 'writeFile' && toolInput) {
                          if (toolPart.state === 'output-available' || toolPart.state === 'input-available') {
                            return (
                              <div key={i} className="my-2 overflow-hidden max-w-full min-w-0">
                                <WriteFileDiff
                                  currentContent={currentFile?.content ?? ''}
                                  proposedContent={toolInput.content ?? ''}
                                  status={toolCallStatus ?? 'pending'}
                                  onAccept={() => {
                                    // Show diff in editor area for review
                                    pendingDiffToolCallRef.current = { toolCallId, oldText: currentFile?.content ?? '', newText: toolInput.content ?? '', isFullRewrite: true };
                                    setPendingAIDiff({ oldText: currentFile?.content ?? '', newText: toolInput.content ?? '', isFullRewrite: true });
                                  }}
                                  onReject={() => {
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'rejected' }));
                                  }}
                                  onRestore={() => {
                                    pendingDiffToolCallRef.current = { toolCallId, oldText: currentFile?.content ?? '', newText: toolInput.content ?? '', isFullRewrite: true };
                                    setPendingAIDiff({ oldText: currentFile?.content ?? '', newText: toolInput.content ?? '', isFullRewrite: true });
                                  }}
                                />
                              </div>
                            );
                          }
                          return (
                            <p key={i} className="my-2 text-xs text-muted-foreground animate-pulse">Rewriting file...</p>
                          );
                        }

                        if (toolName === 'createFile' && toolInput) {
                          if (toolPart.state === 'output-available' || toolPart.state === 'input-available') {
                            return (
                              <div key={i} className="my-2 overflow-hidden max-w-full min-w-0">
                                <CreateFilePreview
                                  filePath={toolInput.path ?? ''}
                                  content={toolInput.content ?? ''}
                                  status={toolCallStatus ?? 'pending'}
                                  onAccept={() => {
                                    const filePath = toolInput.path ?? '';
                                    const op = { type: 'create' as const, path: filePath, content: toolInput.content ?? '' };
                                    addPendingOp(op);
                                    applyOpToTree(op);
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'accepted' }));
                                    // Navigate to the newly created file
                                    if (filePath) navigateToFile(filePath);
                                  }}
                                  onReject={() => {
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'rejected' }));
                                  }}
                                />
                              </div>
                            );
                          }
                          return (
                            <p key={i} className="my-2 text-xs text-muted-foreground animate-pulse">Creating file...</p>
                          );
                        }

                        if (toolName === 'renameFile' && toolInput) {
                          if (toolPart.state === 'output-available' || toolPart.state === 'input-available') {
                            return (
                              <div key={i} className="my-2 overflow-hidden max-w-full min-w-0">
                                <RenameFilePreview
                                  oldPath={toolInput.oldPath ?? ''}
                                  newPath={toolInput.newPath ?? ''}
                                  status={toolCallStatus ?? 'pending'}
                                  onAccept={() => {
                                    const op = { type: 'rename' as const, oldPath: toolInput.oldPath ?? '', newPath: toolInput.newPath ?? '', sha: '', content: '' };
                                    addPendingOp(op);
                                    applyOpToTree(op);
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'accepted' }));
                                  }}
                                  onReject={() => {
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'rejected' }));
                                  }}
                                />
                              </div>
                            );
                          }
                          return <p key={i} className="my-2 text-xs text-muted-foreground animate-pulse">Renaming file...</p>;
                        }

                        if (toolName === 'deleteFile' && toolInput) {
                          if (toolPart.state === 'output-available' || toolPart.state === 'input-available') {
                            return (
                              <div key={i} className="my-2 overflow-hidden max-w-full min-w-0">
                                <DeleteFilePreview
                                  filePath={toolInput.path ?? ''}
                                  status={toolCallStatus ?? 'pending'}
                                  onAccept={() => {
                                    const op = { type: 'delete' as const, path: toolInput.path ?? '', sha: '' };
                                    addPendingOp(op);
                                    applyOpToTree(op);
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'accepted' }));
                                  }}
                                  onReject={() => {
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'rejected' }));
                                  }}
                                />
                              </div>
                            );
                          }
                          return <p key={i} className="my-2 text-xs text-muted-foreground animate-pulse">Deleting file...</p>;
                        }

                        if (toolName === 'commitChanges' && toolInput) {
                          if (toolPart.state === 'output-available' || toolPart.state === 'input-available') {
                            return (
                              <div key={i} className="my-2 overflow-hidden max-w-full min-w-0">
                                <CommitProposal
                                  message={toolInput.message ?? ''}
                                  description={toolInput.description}
                                  status={toolCallStatus ?? 'pending'}
                                  onAccept={() => {
                                    navigator.clipboard.writeText(toolInput.message ?? '').catch(() => {});
                                    toast.success('Commit message copied — use Push button to commit');
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'accepted' }));
                                  }}
                                  onReject={() => {
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'rejected' }));
                                  }}
                                />
                              </div>
                            );
                          }
                          return <p key={i} className="my-2 text-xs text-muted-foreground animate-pulse">Preparing commit...</p>;
                        }

                        if (toolName === 'createBranch' && toolInput) {
                          if (toolPart.state === 'output-available' || toolPart.state === 'input-available') {
                            return (
                              <div key={i} className="my-2 overflow-hidden max-w-full min-w-0">
                                <CreateBranchProposal
                                  branchName={toolInput.branchName ?? ''}
                                  sourceBranch={toolInput.sourceBranch}
                                  status={toolCallStatus ?? 'pending'}
                                  onAccept={() => {
                                    navigator.clipboard.writeText(toolInput.branchName ?? '').catch(() => {});
                                    toast.success('Branch name copied — use branch selector to create');
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'accepted' }));
                                  }}
                                  onReject={() => {
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'rejected' }));
                                  }}
                                />
                              </div>
                            );
                          }
                          return <p key={i} className="my-2 text-xs text-muted-foreground animate-pulse">Creating branch...</p>;
                        }

                        if (toolName === 'suggestResponses') {
                          const toolInputAny = toolPart.input as Record<string, any> | undefined;
                          const suggestions = toolInputAny?.suggestions as string[] | undefined;
                          if (suggestions && (toolPart.state === 'output-available' || toolPart.state === 'input-available')) {
                            return (
                              <div key={i} className="my-2">
                                <SuggestResponsesView
                                  suggestions={suggestions}
                                  onSelect={(text) => {
                                    sendMessage({ text });
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'accepted' }));
                                  }}
                                />
                              </div>
                            );
                          }
                          return null;
                        }

                        // Server-side tool results (readFile, searchFiles, listFiles, fetchURL, webSearch)
                        if (toolPart.state === 'output-available') {
                          const toolOutput = toolPart.output as Record<string, any> | undefined;
                          if (toolName === 'readFile') {
                            return (
                              <div key={i} className="my-2">
                                <ToolResultDisplay icon={<FileText className="size-3 text-muted-foreground" />} label={`Read ${(toolInput as any)?.path ?? 'file'}`}>
                                  {toolOutput?.error ? (
                                    <p className="p-2 text-xs text-red-500">{toolOutput.error}</p>
                                  ) : (
                                    <pre className="p-2 text-xs overflow-auto max-h-40"><code>{String(toolOutput?.content ?? '').slice(0, 2000)}{(toolOutput?.content?.length ?? 0) > 2000 ? '...' : ''}</code></pre>
                                  )}
                                </ToolResultDisplay>
                              </div>
                            );
                          }
                          if (toolName === 'searchFiles') {
                            if (toolOutput?.error) {
                              return (
                                <div key={i} className="my-2">
                                  <ToolResultDisplay icon={<Search className="size-3 text-muted-foreground" />} label="Search failed">
                                    <p className="p-2 text-xs text-red-500">{toolOutput.error}</p>
                                  </ToolResultDisplay>
                                </div>
                              );
                            }
                            const results = (toolOutput?.results ?? []) as { path: string; name: string }[];
                            // Don't show a big UI for 0-result searches — collapse to a single line
                            if (results.length === 0) {
                              return (
                                <div key={i} className="my-1">
                                  <p className="text-xs text-muted-foreground/60">No matches for &quot;{(toolInput as any)?.query ?? 'query'}&quot;</p>
                                </div>
                              );
                            }
                            return (
                              <div key={i} className="my-2">
                                <ToolResultDisplay icon={<Search className="size-3 text-muted-foreground" />} label={`Found ${toolOutput?.total ?? 0} results`}>
                                  <div className="p-2 space-y-0.5">
                                    {results.map((r, ri) => (
                                      <p key={ri} className="text-xs font-mono text-muted-foreground truncate">{r.path}</p>
                                    ))}
                                  </div>
                                </ToolResultDisplay>
                              </div>
                            );
                          }
                          if (toolName === 'listFiles') {
                            if (toolOutput?.error) {
                              return (
                                <div key={i} className="my-2">
                                  <ToolResultDisplay icon={<FolderOpen className="size-3 text-muted-foreground" />} label="Listing failed">
                                    <p className="p-2 text-xs text-red-500">{toolOutput.error}</p>
                                  </ToolResultDisplay>
                                </div>
                              );
                            }
                            const entries = (toolOutput?.entries ?? []) as { name: string; type: string }[];
                            return (
                              <div key={i} className="my-2">
                                <ToolResultDisplay icon={<FolderOpen className="size-3 text-muted-foreground" />} label={`Listed ${entries.length} items`}>
                                  <div className="p-2 space-y-0.5">
                                    {entries.map((e, ei) => (
                                      <p key={ei} className="text-xs font-mono text-muted-foreground">{e.type === 'dir' ? `${e.name}/` : e.name}</p>
                                    ))}
                                  </div>
                                </ToolResultDisplay>
                              </div>
                            );
                          }
                          if (toolName === 'fetchURL') {
                            return (
                              <div key={i} className="my-2">
                                <ToolResultDisplay icon={<Link className="size-3 text-muted-foreground" />} label={`Fetched ${(toolInput as any)?.url?.slice(0, 40) ?? 'URL'}...`}>
                                  {toolOutput?.error ? (
                                    <p className="p-2 text-xs text-red-500">{toolOutput.error}</p>
                                  ) : (
                                    <pre className="p-2 text-xs overflow-auto max-h-40 whitespace-pre-wrap"><code>{String(toolOutput?.content ?? '').slice(0, 1000)}{(toolOutput?.content?.length ?? 0) > 1000 ? '...' : ''}</code></pre>
                                  )}
                                </ToolResultDisplay>
                              </div>
                            );
                          }
                          if (toolName === 'webSearch') {
                            const results = (toolOutput?.results ?? []) as { title: string; url: string; description?: string }[];
                            return (
                              <div key={i} className="my-2">
                                <ToolResultDisplay icon={<Globe className="size-3 text-muted-foreground" />} label={`Search: ${(toolInput as any)?.query ?? ''}`}>
                                  <div className="p-2 space-y-1.5">
                                    {results.map((r, ri) => (
                                      <div key={ri}>
                                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">{r.title || r.url}</a>
                                        {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                                      </div>
                                    ))}
                                    {results.length === 0 && <p className="text-xs text-muted-foreground">{toolOutput?.note ?? 'No results'}</p>}
                                  </div>
                                </ToolResultDisplay>
                              </div>
                            );
                          }
                          if (toolName === 'getBranches') {
                            if (toolOutput?.error) {
                              return (
                                <div key={i} className="my-2">
                                  <ToolResultDisplay icon={<GitBranch className="size-3 text-muted-foreground" />} label="Branches failed">
                                    <p className="p-2 text-xs text-red-500">{toolOutput.error}</p>
                                  </ToolResultDisplay>
                                </div>
                              );
                            }
                            const branches = (toolOutput?.branches ?? []) as { name: string; protected: boolean }[];
                            return (
                              <div key={i} className="my-2">
                                <ToolResultDisplay icon={<GitBranch className="size-3 text-muted-foreground" />} label={`${branches.length} branches`}>
                                  <div className="p-2 space-y-0.5">
                                    {branches.map((b, bi) => (
                                      <p key={bi} className="text-xs font-mono text-muted-foreground">
                                        {b.name === toolOutput?.currentBranch ? <span className="text-green-600">{b.name} (current)</span> : b.name}
                                        {b.protected && <span className="ml-1 text-amber-500">protected</span>}
                                      </p>
                                    ))}
                                  </div>
                                </ToolResultDisplay>
                              </div>
                            );
                          }
                          if (toolName === 'getCollaborators') {
                            if (toolOutput?.error) {
                              return (
                                <div key={i} className="my-2">
                                  <ToolResultDisplay icon={<Users className="size-3 text-muted-foreground" />} label="Collaborators failed">
                                    <p className="p-2 text-xs text-red-500">{toolOutput.error}</p>
                                  </ToolResultDisplay>
                                </div>
                              );
                            }
                            const collaborators = (toolOutput?.collaborators ?? []) as { login: string; role?: string; contributions?: number }[];
                            return (
                              <div key={i} className="my-2">
                                <ToolResultDisplay icon={<Users className="size-3 text-muted-foreground" />} label={`${collaborators.length} collaborators`}>
                                  <div className="p-2 space-y-0.5">
                                    {collaborators.map((c, ci) => (
                                      <p key={ci} className="text-xs text-muted-foreground">
                                        <span className="font-mono font-medium">{c.login}</span>
                                        {c.role && <span className="ml-1 text-muted-foreground/60">({c.role})</span>}
                                      </p>
                                    ))}
                                  </div>
                                </ToolResultDisplay>
                              </div>
                            );
                          }
                        }

                        // Loading state for server-side tools (both streaming input and executing)
                        if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
                          const loadingLabels: Record<string, string> = {
                            readFile: 'Reading file...',
                            searchFiles: 'Searching...',
                            listFiles: 'Listing files...',
                            fetchURL: 'Fetching URL...',
                            webSearch: 'Searching the web...',
                            getBranches: 'Loading branches...',
                            getCollaborators: 'Loading collaborators...',
                          };
                          const label = loadingLabels[toolName ?? ''];
                          if (label) {
                            return <p key={i} className="my-2 text-xs text-muted-foreground animate-pulse">{label}</p>;
                          }
                        }

                        // Fallback for unknown tools
                        return (
                          <div key={i} className="my-2 rounded-md border bg-muted/50 p-2 text-xs">
                            <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                              <Wrench className="h-3 w-3" />
                              {toolName}
                              {toolPart.state === 'output-available' && <Check className="h-3 w-3 text-green-500" />}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }) ?? null}
                    {/* Batch Accept All / Reject All when 2+ pending edits */}
                    {message.role === 'assistant' && (() => {
                      const pending = getPendingEditIds(message);
                      if (pending.length < 2) return null;
                      return (
                        <div className="mt-4 flex items-center justify-between rounded-md border bg-background/60 px-3 py-2">
                          <span className="text-xs text-muted-foreground">
                            {pending.length} edits pending
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRejectAll(message)}
                              className="h-6 text-[11px] px-2"
                              aria-label={`Dismiss all ${pending.length} edits (Cmd+Shift+N)`}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Dismiss all
                              <span className="-ml-0.5 font-normal opacity-60" aria-hidden="true">{'\u2318\u21E7'}N</span>
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAcceptAll(message)}
                              className="h-6 text-[11px] px-2"
                              aria-label={`Keep all ${pending.length} edits (Cmd+Shift+Y)`}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Keep all
                              <span className="-ml-0.5 font-normal opacity-60" aria-hidden="true">{'\u2318\u21E7'}Y</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {message.role === 'user' && (
                    <UserMessageAvatar photoURL={user?.photoURL} />
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <p className="px-1 py-2 text-sm text-muted-foreground animate-pulse" role="status" aria-live="polite">Thinking...</p>
              )}
            </div>
            {/* Scroll sentinel — scrollIntoView target for auto-scroll */}
            <div ref={messagesEndRef} />
            {/* ARIA live region for screen readers */}
            <div className="sr-only" aria-live="assertive" aria-atomic="true">
              {isLoading ? 'AI is generating a response' : ''}
            </div>
          </ScrollArea>
          </ChatErrorBoundary>

          {/* ── Revert all AI edits ────────────────────────────────── */}
          {aiEditSnapshots.length > 0 && (
            <div className="mx-3 mb-1">
              <button
                onClick={handleRevertAll}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-accent/50 active:scale-[0.99] transition-all"
                aria-label={`Revert all ${aiEditSnapshots.length} AI edits`}
              >
                <RotateCcw className="h-3 w-3" />
                Revert all AI edits ({aiEditSnapshots.length})
              </button>
            </div>
          )}

          {/* ── Error banner ────────────────────────────────────────── */}
          {errorMessage && (
            <div className="mx-3 mb-2 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1 text-xs">{errorMessage}</span>
              <button onClick={dismissError} className="shrink-0 hover:opacity-70">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          </>
          )}

          {/* ── Context file badges (above input) ─────────────────── */}
          <div className="flex items-center gap-1 flex-wrap px-3 pt-2">
            {currentFile && !excludeCurrentFile && (
              <Badge variant="secondary" className="gap-1 pr-1 text-xs shrink-0">
                <FileText className="h-3 w-3" />
                {currentFile.name}
                <button
                  type="button"
                  onClick={() => setExcludeCurrentFile(true)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {extraMentionedFiles.map((file) => (
              <Badge
                key={file.path}
                variant="secondary"
                className="gap-1 pr-1 text-xs shrink-0"
              >
                <FileText className="h-3 w-3" />
                {file.name}
                <button
                  type="button"
                  onClick={() => removeMentionedFile(file.path)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <button
              type="button"
              data-testid="ai-add-context"
              aria-label="Add file context to AI conversation"
              className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-accent transition-colors shrink-0"
              onClick={openMentionPicker}
              title="Add file context"
            >
              <Plus className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          {/* ── Input area ──────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="p-3 pt-1.5">
            <div className="relative rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
              <Textarea
                ref={textareaRef}
                data-testid="ai-chat-input"
                aria-label="Message for AI assistant"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask AI about your file..."
                className="min-h-[60px] resize-none border-0 pr-16 pb-2 text-sm shadow-none focus-visible:ring-0"
              />

              {/* Mic + Send buttons */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-testid="ai-mic-button"
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  className="h-7 w-7 rounded-lg"
                  onClick={toggleListening}
                >
                  {isListening ? (
                    <MicOff className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  data-testid="ai-send-button"
                  aria-label={isLoading ? "AI is generating a response" : "Send message to AI"}
                  className="h-7 w-7 rounded-lg"
                  disabled={isLoading || !input.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              {/* Mention autocomplete dropdown */}
              {showMentionDropdown && filteredMentionFiles.length > 0 && (
                <div
                  ref={mentionDropdownRef}
                  className="absolute bottom-full left-0 z-50 mb-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
                >
                  {filteredMentionFiles.map((file, index) => (
                    <button
                      key={file.path}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
                        index === selectedMentionIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => handleMentionSelect(file)}
                      onMouseEnter={() => setSelectedMentionIndex(index)}
                    >
                      <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{file.name}</span>
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {file.path}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {showMentionDropdown && filteredMentionFiles.length === 0 && (
                <div
                  ref={mentionDropdownRef}
                  className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-md border bg-popover p-3 shadow-md"
                >
                  <p className="text-center text-xs text-muted-foreground">
                    No matching files found
                  </p>
                </div>
              )}
            </div>

            {/* Bottom row: model selector + context usage */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <AIProviderSelect />
              </div>
              <Context
                maxTokens={maxTokens}
                usedTokens={tokenUsage.total}
                usage={{
                  inputTokens: tokenUsage.inputTokens,
                  outputTokens: tokenUsage.outputTokens,
                  inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
                  outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
                  totalTokens: tokenUsage.total,
                }}
                modelId={`${aiProvider}:${aiModel}`}
              >
                <ContextTrigger className="h-8 px-2 text-xs" />
                <ContextContent side="top" align="end">
                  <ContextContentHeader />
                  <ContextContentBody>
                    <ContextInputUsage />
                    <ContextOutputUsage />
                  </ContextContentBody>
                  <ContextContentFooter />
                </ContextContent>
              </Context>
            </div>
          </form>
        </>
      )}
    </aside>
  );
}
