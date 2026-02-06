'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface CommentInputProps {
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function CommentInput({ onSubmit, onCancel, placeholder = 'Write a comment...', autoFocus }: CommentInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit(content.trim());
    setContent('');
  };

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="min-h-[60px] resize-none text-sm"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === 'Escape' && onCancel) {
            onCancel();
          }
        }}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={!content.trim()}>
          <Send className="mr-1 h-3 w-3" />
          Send
        </Button>
      </div>
    </div>
  );
}
