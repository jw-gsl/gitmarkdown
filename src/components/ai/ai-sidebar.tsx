'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, X, Sparkles, Loader2, AtSign, Trash2, FileText, AlertCircle, Wrench, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AIMessageAvatar, EditToolDiff } from '@/components/ai/chat-message';
import { AIProviderSelect } from './ai-provider-select';
import { useSettingsStore } from '@/stores/settings-store';
import { useFileStore } from '@/stores/file-store';
import { useSyncStore } from '@/stores/sync-store';
import { useUIStore } from '@/stores/ui-store';
import { useGitHubContent } from '@/hooks/use-github';
import type { FileNode } from '@/types';

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

export function AISidebar({ isOpen, onClose }: AISidebarProps) {
  const params = useParams();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const { aiProvider, aiModel } = useSettingsStore();
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

  // Get all markdown files from the file tree
  const allMarkdownFiles = useMemo(() => {
    return flattenFiles(files).filter((f) => f.isMarkdown);
  }, [files]);

  // Filter files based on mention query
  const filteredMentionFiles = useMemo(() => {
    if (!mentionQuery) return allMarkdownFiles;
    const query = mentionQuery.toLowerCase();
    return allMarkdownFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        f.path.toLowerCase().includes(query)
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
      `Improve the writing`,
      `Fix grammar and spelling`,
      `Add more detail`,
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
        },
      }),
    [aiProvider, aiModel, fileContextString]
  );

  const { messages, sendMessage, status, setMessages, error } = useChat({
    transport,
    onError: (err) => {
      // Try to parse a JSON error message from the response
      try {
        const parsed = JSON.parse(err.message);
        setErrorMessage(parsed.error || err.message);
      } catch {
        setErrorMessage(err.message);
      }
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

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

  const handleMentionSelect = useCallback(
    async (file: FileNode) => {
      // Remove the @query text from input (don't insert @filename — shown as badge instead)
      const before = input.slice(0, mentionStartIndex);
      const after = input.slice(textareaRef.current?.selectionStart ?? input.length);
      setInput(`${before}${after}`);

      setShowMentionDropdown(false);
      setMentionQuery('');
      setMentionStartIndex(-1);
      setSelectedMentionIndex(0);

      // Skip if already mentioned
      if (mentionedFiles.find((f) => f.path === file.path)) {
        setTimeout(() => textareaRef.current?.focus(), 0);
        return;
      }

      // Fetch the file content from GitHub
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
        // If fetch fails, add without content
        setMentionedFiles((prev) => [
          ...prev,
          { path: file.path, name: file.name, content: '' },
        ]);
      }

      // Re-focus textarea
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [input, mentionStartIndex, mentionedFiles, fetchContent, owner, repo, currentBranch]
  );

  const removeMentionedFile = useCallback((filePath: string) => {
    setMentionedFiles((prev) => prev.filter((f) => f.path !== filePath));
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInput(value);

      const cursorPos = e.target.selectionStart;
      // Look backwards from cursor for an @ that starts a mention
      const textBeforeCursor = value.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        const textBetween = textBeforeCursor.slice(lastAtIndex + 1);
        // Only show dropdown if there's no space in the mention query (still typing the mention)
        // and the @ is either at the start or preceded by a space
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

      // Normal Enter to submit (without shift)
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

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setMessages([]);
              setErrorMessage(null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 && !errorMessage && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">How can I help?</p>
            <p className="mt-1 text-xs text-muted-foreground mb-4">
              Type <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">@</kbd> to mention a file for context.
            </p>
            <div className="flex flex-wrap gap-2 px-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { sendMessage({ text: s }); }}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''} min-w-0`}
            >
              {message.role === 'assistant' && (
                <AIMessageAvatar size="md" />
              )}
              <div
                className={`rounded-lg px-3 py-2 text-sm overflow-hidden ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground max-w-[85%]'
                    : 'min-w-0 flex-1 bg-muted'
                }`}
              >
                {message.parts?.map((part, i) => {
                  if (part.type === 'text') {
                    if (message.role === 'assistant') {
                      return (
                        <div key={i} className="prose prose-sm dark:prose-invert max-w-none break-words overflow-x-auto prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-pre:bg-background/50 prose-code:text-xs prose-pre:text-xs">
                          <ReactMarkdown>{part.text}</ReactMarkdown>
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
                  if (part.type === 'dynamic-tool') {
                    const toolInput = part.input as Record<string, string> | undefined;
                    const toolCallId = `${message.id}-${i}`;
                    const toolCallStatus = toolCallStatuses[toolCallId];

                    if (part.toolName === 'editFile' && toolInput) {
                      // Show the diff view directly (no wrench/tool chrome)
                      if (part.state === 'output-available') {
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
                      // Tool still executing
                      return (
                        <div key={i} className="my-2 flex items-center gap-2 py-1">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Editing document...</span>
                        </div>
                      );
                    }

                    // Generic tool rendering for non-editFile tools
                    return (
                      <div key={i} className="my-2 rounded-md border bg-muted/50 p-2 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <Wrench className="h-3 w-3" />
                          {part.toolName}
                          {part.state === 'output-available' && <Check className="h-3 w-3 text-green-500" />}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }) ?? null}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3 min-w-0">
              <AIMessageAvatar size="md" />
              <div className="rounded-lg bg-muted px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Error banner */}
      {errorMessage && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1 text-xs">{errorMessage}</span>
          <button onClick={dismissError} className="shrink-0 hover:opacity-70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t p-3">
        {/* Textarea with mention badges and send button */}
        <div className="relative rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
          {/* Mentioned files chips inside the input container */}
          {mentionedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1 px-2.5 pt-2">
              {mentionedFiles.map((file) => (
                <Badge
                  key={file.path}
                  variant="secondary"
                  className="gap-1 pr-1 text-[10px]"
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
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI about your document..."
            className="min-h-[60px] resize-none border-0 pr-10 pb-8 text-sm shadow-none focus-visible:ring-0"
          />
          {/* Send button overlaid at bottom-right of textarea */}
          <Button
            type="submit"
            size="icon"
            className="absolute bottom-2 right-2 h-7 w-7 rounded-lg"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </Button>

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
        </div>{/* end input container */}

        {/* Bottom row: file context + model selector */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            {currentFile && (
              <span className="flex items-center gap-1" title={currentFile.path}>
                <AtSign className="h-3 w-3" />
                <span className="max-w-[80px] truncate">{currentFile.name}</span>
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <AIProviderSelect />
          </div>
        </div>
      </form>
    </div>
  );
}
