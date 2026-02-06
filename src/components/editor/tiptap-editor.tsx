'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import { useEffect, useCallback } from 'react';
import { getEditorExtensions } from '@/lib/editor/config';
import { EditorToolbar } from './toolbar';
import { EditorBubbleMenu } from './bubble-menu';
import { SlashCommandMenu } from './slash-command';

interface TiptapEditorProps {
  content: string;
  onChange?: (markdown: string) => void;
  editable?: boolean;
  className?: string;
  placeholder?: string;
}

export function TiptapEditor({
  content,
  onChange,
  editable = true,
  className = '',
  placeholder,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      ...getEditorExtensions({ placeholder }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: '-',
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        const storage = editor.storage as Record<string, any>;
        const markdown = storage.markdown?.getMarkdown() || '';
        onChange(markdown);
      }
    },
  });

  useEffect(() => {
    if (editor && content !== (editor.storage as Record<string, any>).markdown?.getMarkdown()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className={`relative ${className}`}>
      <EditorToolbar editor={editor} />
      <EditorBubbleMenu editor={editor} />
      <SlashCommandMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
