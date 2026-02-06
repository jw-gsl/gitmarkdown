'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCompletion } from '@ai-sdk/react';
import { X, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettingsStore } from '@/stores/settings-store';

interface AIEditPopupProps {
  isOpen: boolean;
  selectedText: string;
  context: string;
  position: { top: number; left: number };
  onAccept: (newText: string) => void;
  onReject: () => void;
  onClose: () => void;
}

export function AIEditPopup({
  isOpen,
  selectedText,
  context,
  position,
  onAccept,
  onReject,
  onClose,
}: AIEditPopupProps) {
  const [instruction, setInstruction] = useState('');
  const { aiProvider, aiModel } = useSettingsStore();

  const { completion, complete, isLoading } = useCompletion({
    api: '/api/ai/edit',
    body: {
      selectedText,
      context,
      provider: aiProvider,
      modelId: aiModel,
    },
  });

  const handleSubmit = async () => {
    if (!instruction.trim()) return;
    await complete(instruction);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (completion && !isLoading) {
          onAccept(completion);
        } else {
          handleSubmit();
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [completion, isLoading, onAccept, onClose]
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute z-50 w-96 rounded-lg border bg-popover p-3 shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI Edit
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!completion && (
        <div className="flex gap-2">
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="What should I change?"
            className="h-8 text-sm"
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Button size="sm" className="h-8" onClick={handleSubmit} disabled={isLoading || !instruction.trim()}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Edit'}
          </Button>
        </div>
      )}

      {(completion || isLoading) && (
        <div className="mt-2">
          <div className="mb-2 rounded border">
            <div className="border-b bg-red-50 px-3 py-1.5 text-xs dark:bg-red-950/30">
              <span className="font-medium text-red-700 dark:text-red-400">Original</span>
            </div>
            <pre className="overflow-x-auto p-3 text-xs">{selectedText}</pre>
          </div>
          <div className="rounded border">
            <div className="border-b bg-green-50 px-3 py-1.5 text-xs dark:bg-green-950/30">
              <span className="font-medium text-green-700 dark:text-green-400">Suggested</span>
            </div>
            <pre className="overflow-x-auto p-3 text-xs">
              {isLoading && !completion ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                completion
              )}
            </pre>
          </div>
          {completion && !isLoading && (
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReject}>
                <X className="mr-1 h-3 w-3" />
                Reject
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => onAccept(completion)}>
                <Check className="mr-1 h-3 w-3" />
                Accept
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
