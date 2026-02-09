'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, X, ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AIMessageAvatar,
  UserMessageAvatar,
  EditToolDiff,
  StreamingIndicator,
} from '@/components/ai/chat-message';
import { DiffView } from '@/components/ai/diff-view';
import { useSettingsStore } from '@/stores/settings-store';
import { isMarkdownFile } from '@/lib/editor/markdown-serializer';

interface InlineEditPanelProps {
  selectedText: string;
  selectionFrom: number;
  selectionTo: number;
  context: string;
  onAccept: (newText: string) => void;
  onReject: () => void;
  onClose: () => void;
  filename?: string;
}

interface EditMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const writingSuggestions = ['Fix grammar', 'Make concise', 'Improve clarity', 'Make formal'];
const codeSuggestions = ['Fix bug', 'Add types', 'Simplify', 'Add error handling'];

let messageIdCounter = 0;
function generateMessageId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

export function InlineEditPanel({
  selectedText,
  onAccept,
  onReject,
  onClose,
  context,
  filename,
}: InlineEditPanelProps) {
  const [messages, setMessages] = useState<EditMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const aiModel = useSettingsStore((s) => s.aiModel);
  const quickSuggestions = filename && !isMarkdownFile(filename) ? codeSuggestions : writingSuggestions;

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const submitInstruction = useCallback(
    async (instruction: string) => {
      if (!instruction.trim() || isStreaming) return;

      const userMessageId = generateMessageId();
      const assistantMessageId = generateMessageId();

      // Add user message and empty streaming assistant message
      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: 'user', content: instruction },
        { id: assistantMessageId, role: 'assistant', content: '', isStreaming: true },
      ]);
      setInputValue('');
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch('/api/ai/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction,
            selectedText,
            context,
            provider: aiProvider,
            modelId: aiModel,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('AI edit request failed');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let result = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
          const currentResult = result;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: currentResult }
                : msg
            )
          );
        }

        // Mark streaming as done
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // Remove the failed assistant message
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
      } finally {
        setIsStreaming(false);
      }
    },
    [selectedText, context, aiProvider, aiModel, isStreaming]
  );

  const handleSubmit = () => {
    submitInstruction(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickSuggestion = (suggestion: string) => {
    submitInstruction(suggestion);
  };

  const handleAccept = (content: string) => {
    onAccept(content);
  };

  const handleReject = () => {
    onReject();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200 sm:absolute sm:inset-auto sm:right-4 sm:top-16 sm:w-96 sm:animate-in sm:slide-in-from-right-4 sm:fade-in" data-testid="inline-edit-panel">
      <div className="flex max-h-[70vh] flex-col rounded-t-xl border bg-background shadow-xl sm:max-h-[80vh] sm:rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Pencil className="size-3.5" />
            Edit text
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose} data-testid="inline-edit-cancel" aria-label="Close inline edit panel">
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Selected text preview */}
        <div className="border-b px-3 py-2">
          <p className="line-clamp-2 text-xs text-muted-foreground italic">
            &ldquo;{selectedText}&rdquo;
          </p>
        </div>

        {/* Messages area */}
        <div ref={scrollAreaRef} className="flex-1 overflow-auto p-3">
          {messages.length === 0 ? (
            /* Quick suggestions shown only when no messages */
            <div className="flex flex-wrap gap-1.5">
              {quickSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleQuickSuggestion(suggestion)}
                  className="rounded-full border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  data-testid={`inline-edit-suggestion-${suggestion.toLowerCase().replace(/\s+/g, '-')}`}
                  aria-label={`Apply quick edit: ${suggestion}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === 'user' ? (
                    /* User message */
                    <div className="flex items-start gap-2">
                      <UserMessageAvatar />
                      <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  ) : (
                    /* Assistant message */
                    <div className="flex items-start gap-2">
                      <AIMessageAvatar />
                      <div className="flex-1 space-y-2">
                        {message.isStreaming && !message.content ? (
                          /* Still waiting for first chunk */
                          <StreamingIndicator label="Editing..." />
                        ) : message.content ? (
                          /* Show diff */
                          <>
                            {message.isStreaming ? (
                              <>
                                <StreamingIndicator label="Generating..." />
                                <DiffView
                                  original={selectedText}
                                  modified={message.content}
                                  showActions={false}
                                  className="max-h-64"
                                />
                              </>
                            ) : (
                              <EditToolDiff
                                oldText={selectedText}
                                newText={message.content}
                                onAccept={(editedText) => handleAccept(editedText)}
                                onReject={handleReject}
                              />
                            )}
                          </>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input area - always visible at bottom */}
        <div className="border-t px-3 py-2">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={messages.length === 0 ? 'Enter edit instructions...' : 'Send follow-up instruction...'}
              className="h-8 text-sm"
              disabled={isStreaming}
              data-testid="inline-edit-input"
              aria-label="AI edit instruction"
            />
            <Button
              size="icon-xs"
              className="size-8 shrink-0"
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isStreaming}
              data-testid="inline-edit-submit"
              aria-label="Apply AI edit"
              aria-busy={isStreaming}
            >
              {isStreaming ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowUp className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
