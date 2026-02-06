'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { Send, X, Sparkles, Loader2, AtSign, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AIProviderSelect } from './ai-provider-select';
import { useSettingsStore } from '@/stores/settings-store';
import { useFileStore } from '@/stores/file-store';

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AISidebar({ isOpen, onClose }: AISidebarProps) {
  const { aiProvider, aiModel } = useSettingsStore();
  const { currentFile } = useFileStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  const transport = useMemo(() => new TextStreamChatTransport({
    api: '/api/ai/chat',
    body: {
      provider: aiProvider,
      modelId: aiModel,
      fileContext: currentFile?.content
        ? `File: ${currentFile.path}\n\n${currentFile.content}`
        : undefined,
    },
  }), [aiProvider, aiModel, currentFile?.content, currentFile?.path]);

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
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
            onClick={() => setMessages([])}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="border-b px-4 py-2">
        <AIProviderSelect />
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">How can I help?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask me to write, edit, or improve your markdown.
            </p>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">AI</AvatarFallback>
                </Avatar>
              )}
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground max-w-[85%]'
                    : 'bg-muted max-w-[90%]'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {message.parts?.map((part, i) =>
                    part.type === 'text' ? <span key={i}>{part.text}</span> : null
                  ) ?? null}
                </div>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">AI</AvatarFallback>
              </Avatar>
              <div className="rounded-lg bg-muted px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="border-t p-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI about your document..."
            className="min-h-[60px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {currentFile && (
              <span className="flex items-center gap-1">
                <AtSign className="h-3 w-3" />
                {currentFile.name}
              </span>
            )}
          </div>
          <Button type="submit" size="sm" disabled={isLoading || !input.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
