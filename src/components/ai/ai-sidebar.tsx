'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, getToolName, type DynamicToolUIPart } from 'ai';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import {
  ArrowUp, X, Sparkles, Loader2, FileText, AlertCircle, Wrench, Check, CheckCheck, XCircle,
  History, Plus, Trash2, Mic, MicOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { EditToolDiff } from '@/components/ai/chat-message';
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
  const owner = params.owner as string;
  const repo = params.repo as string;
  const { user } = useAuth();
  const { aiProvider, aiModel } = useSettingsStore();
  const activePersona = useActivePersona();
  const { currentFile, files } = useFileStore();
  const { currentBranch } = useSyncStore();
  const { fetchContent } = useGitHubContent();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [mentionedFiles, setMentionedFiles] = useState<MentionedFile[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toolCallStatuses, setToolCallStatuses] = useState<Record<string, 'accepted' | 'rejected'>>({});
  const aiChatContext = useUIStore((s) => s.aiChatContext);
  const setAIChatContext = useUIStore((s) => s.setAIChatContext);
  const setPendingTextEdit = useUIStore((s) => s.setPendingTextEdit);

  // ── Chat history state ─────────────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);
  const [chatList, setChatList] = useState<AIChat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const titleGenerated = useRef(false);
  const prevStatus = useRef<string>('ready');

  // ── Speech recognition state ───────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Get all markdown files from the file tree
  const allMarkdownFiles = useMemo(() => {
    return flattenFiles(files).filter((f) => f.isMarkdown);
  }, [files]);

  // Filter files based on mention query
  const filteredMentionFiles = useMemo(() => {
    if (!mentionQuery) return allMarkdownFiles;
    const q = mentionQuery.toLowerCase();
    return allMarkdownFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.path.toLowerCase().includes(q)
    );
  }, [allMarkdownFiles, mentionQuery]);

  // Build file context string from mentioned files + current file
  const fileContextString = useMemo(() => {
    const parts: string[] = [];
    if (currentFile?.content) {
      parts.push(`Current file (${currentFile.path}):\n\n${currentFile.content}`);
    }
    for (const mf of mentionedFiles) {
      if (mf.content && mf.path !== currentFile?.path) {
        parts.push(`Referenced file (${mf.path}):\n\n${mf.content}`);
      }
    }
    return parts.length > 0 ? parts.join('\n\n---\n\n') : undefined;
  }, [currentFile, mentionedFiles]);

  const suggestions = useMemo(() => {
    if (!currentFile) return ['Write a blog post', 'Create a README', 'Generate a table of contents'];
    return [
      `Summarize ${currentFile.name}`,
      'Improve the writing',
      'Fix grammar and spelling',
      'Add more detail',
    ];
  }, [currentFile]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/chat',
        body: {
          provider: aiProvider,
          modelId: aiModel,
          fileContext: fileContextString,
          personaInstructions: activePersona.instructions || undefined,
          personaName: activePersona.name,
        },
      }),
    [aiProvider, aiModel, fileContextString, activePersona.instructions, activePersona.name]
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
    } catch {
      // ignore
    } finally {
      setLoadingChats(false);
    }
  }, [user, owner, repo]);

  // Load chat list when opening history
  useEffect(() => {
    if (showHistory && user) loadChatList();
  }, [showHistory, user, loadChatList]);

  // ── Chat history: save current chat ────────────────────────────────
  const saveChat = useCallback(async () => {
    if (!user || messages.length === 0) return;
    try {
      const serialized = JSON.stringify(messages);
      if (currentChatId) {
        await updateAIChat(user.uid, currentChatId, { messages: serialized });
      } else {
        const id = await createAIChat(user.uid, {
          repoFullName: `${owner}/${repo}`,
          title: 'New Chat',
          messages: serialized,
        });
        setCurrentChatId(id);
        // Generate title from first user message
        if (!titleGenerated.current) {
          titleGenerated.current = true;
          const firstUserMsg = messages.find((m) => m.role === 'user');
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
    } catch {
      // ignore save errors
    }
  }, [user, messages, currentChatId, owner, repo]);

  // Auto-save when AI finishes responding (status goes from streaming → ready)
  useEffect(() => {
    if (prevStatus.current === 'streaming' && status === 'ready' && messages.length > 0) {
      saveChat();
    }
    prevStatus.current = status;
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
    async (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation();
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
    },
    [input, isLoading, sendMessage]
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

  /** Collect pending editFile tool call IDs for a given message */
  const getPendingEditIds = useCallback(
    (message: (typeof messages)[number]) => {
      if (message.role !== 'assistant' || !message.parts) return [];
      return message.parts
        .map((part, i) => {
          if (!isToolUIPart(part)) return null;
          const toolPart = part as DynamicToolUIPart;
          const toolName = getToolName(toolPart);
          if (toolName !== 'editFile') return null;
          if (toolPart.state !== 'output-available' && toolPart.state !== 'input-available') return null;
          const toolCallId = toolPart.toolCallId ?? `${message.id}-${i}`;
          if (toolCallStatuses[toolCallId]) return null;
          return { toolCallId, input: toolPart.input as Record<string, string> | undefined };
        })
        .filter(Boolean) as { toolCallId: string; input: Record<string, string> | undefined }[];
    },
    [toolCallStatuses]
  );

  const handleAcceptAll = useCallback(
    (message: (typeof messages)[number]) => {
      const pending = getPendingEditIds(message);
      for (const { toolCallId, input: toolInput } of pending) {
        if (toolInput) {
          setPendingTextEdit({ oldText: toolInput.oldText ?? '', newText: toolInput.newText ?? '' });
        }
        setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'accepted' }));
      }
    },
    [getPendingEditIds, setPendingTextEdit]
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

  if (!isOpen) return null;

  // Extra mentioned files (not the current file)
  const extraMentionedFiles = mentionedFiles.filter((f) => f.path !== currentFile?.path);

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => { setShowHistory(!showHistory); setConfirmDeleteId(null); }}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startNewChat}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <span className="font-semibold text-sm">AI Assistant</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Persona selector ───────────────────────────────────────── */}
      <div className="border-b">
        <PersonaSelector />
      </div>

      {/* ── History panel ───────────────────────────────────────────── */}
      {showHistory ? (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-0.5">
            {loadingChats ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : chatList.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">
                No previous chats
              </p>
            ) : (
              chatList.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center justify-between rounded-md px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors ${
                    chat.id === currentChatId ? 'bg-accent' : ''
                  }`}
                  onClick={() => loadChat(chat)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {chat.updatedAt.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-6 w-6 shrink-0 transition-opacity ${
                      confirmDeleteId === chat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirmDeleteId === chat.id) {
                        handleDeleteChat(chat.id, e);
                        setConfirmDeleteId(null);
                      } else {
                        setConfirmDeleteId(chat.id);
                      }
                    }}
                    title={confirmDeleteId === chat.id ? 'Click to confirm' : 'Delete chat'}
                  >
                    {confirmDeleteId === chat.id ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      ) : (
        <>
          {/* ── Messages area ─────────────────────────────────────────── */}
          <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollRef}>
            {messages.length === 0 && !errorMessage && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">How can I help?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Type <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">@</kbd> to mention a file for context.
                </p>
              </div>
            )}
            <div className="space-y-4">
              {messages.map((message, msgIdx) => (
                <div
                  key={message.id}
                  className={`min-w-0 ${message.role === 'user' ? 'flex justify-end' : 'flex gap-2.5'}`}
                >
                  {message.role === 'assistant' && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs mt-1">
                      {activePersona.avatar}
                    </span>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 text-sm min-w-0 overflow-hidden ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground max-w-[85%]'
                        : 'flex-1 bg-muted'
                    }`}
                  >
                    {message.parts?.map((part, i) => {
                      if (part.type === 'text') {
                        if (message.role === 'assistant') {
                          const isLastAssistant = isLoading && msgIdx === messages.length - 1;
                          return (
                            <div key={i} className="max-w-none break-words overflow-x-auto text-sm">
                              <Streamdown
                                plugins={{ code }}
                                isAnimating={isLastAssistant}
                                caret={isLastAssistant ? 'block' : undefined}
                              >
                                {part.text}
                              </Streamdown>
                            </div>
                          );
                        }
                        // For user messages, render @mentions as inline badges
                        const text = part.text;
                        const mentionRegex = /@([\w\-_.]+\.\w+)/g;
                        const segments: React.ReactNode[] = [];
                        let lastIndex = 0;
                        let match;
                        while ((match = mentionRegex.exec(text)) !== null) {
                          if (match.index > lastIndex) {
                            segments.push(text.slice(lastIndex, match.index));
                          }
                          segments.push(
                            <span key={match.index} className="inline-flex items-center gap-0.5 rounded bg-primary-foreground/20 px-1 py-0.5 text-[11px] font-medium">
                              <FileText className="h-2.5 w-2.5" />
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
                              <div key={i} className="my-2">
                                <EditToolDiff
                                  oldText={toolInput.oldText ?? ''}
                                  newText={toolInput.newText ?? ''}
                                  status={toolCallStatus ?? 'pending'}
                                  onAccept={(editedText) => {
                                    setPendingTextEdit({ oldText: toolInput.oldText ?? '', newText: editedText });
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'accepted' }));
                                  }}
                                  onReject={() => {
                                    setToolCallStatuses((prev) => ({ ...prev, [toolCallId]: 'rejected' }));
                                  }}
                                />
                              </div>
                            );
                          }
                          return (
                            <p key={i} className="my-2 text-xs text-muted-foreground animate-pulse">Editing document...</p>
                          );
                        }

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
                        <div className="mt-3 flex items-center justify-between rounded-md border bg-background/60 px-2.5 py-1.5">
                          <span className="text-[11px] text-muted-foreground">
                            {pending.length} edits pending
                          </span>
                          <div className="flex gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[11px] px-2"
                              onClick={() => handleRejectAll(message)}
                            >
                              <XCircle className="mr-1 h-3 w-3" />
                              Reject all
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 text-[11px] px-2 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleAcceptAll(message)}
                            >
                              <CheckCheck className="mr-1 h-3 w-3" />
                              Accept all
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <p className="px-1 py-2 text-sm text-muted-foreground animate-pulse">Thinking...</p>
              )}
            </div>
          </ScrollArea>

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

          {/* ── Suggestions (no border, 1 per row) ────────────────── */}
          {messages.length === 0 && !errorMessage && (
            <div className="px-3 py-2">
              <div className="flex flex-col gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage({ text: s })}
                    className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-left hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Context file badges (above input) ─────────────────── */}
          <div className="flex items-center gap-1 flex-wrap px-3 pt-2">
            {currentFile && (
              <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
                <FileText className="h-2.5 w-2.5" />
                {currentFile.name}
              </Badge>
            )}
            {extraMentionedFiles.map((file) => (
              <Badge
                key={file.path}
                variant="secondary"
                className="gap-1 pr-1 text-[10px] shrink-0"
              >
                <FileText className="h-2.5 w-2.5" />
                {file.name}
                <button
                  type="button"
                  onClick={() => removeMentionedFile(file.path)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            <button
              type="button"
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
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask AI about your document..."
                className="min-h-[60px] resize-none border-0 pr-16 pb-2 text-sm shadow-none focus-visible:ring-0"
              />

              {/* Mic + Send buttons */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
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
                      <span className="ml-auto truncate text-[10px] text-muted-foreground">
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
    </div>
  );
}
