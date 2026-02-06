'use client';

import { BubbleMenu } from '@tiptap/react/menus';
import { type Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Strikethrough, Code, Link as LinkIcon, Highlighter } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';

interface EditorBubbleMenuProps {
  editor: Editor;
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center gap-0.5 rounded-lg border bg-background p-1 shadow-lg"
    >
      <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        className="h-7 w-7 p-0"
      >
        <Bold className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        className="h-7 w-7 p-0"
      >
        <Italic className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('underline')}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        className="h-7 w-7 p-0"
      >
        <Underline className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('strike')}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        className="h-7 w-7 p-0"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('code')}
        onPressedChange={() => editor.chain().focus().toggleCode().run()}
        className="h-7 w-7 p-0"
      >
        <Code className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('highlight')}
        onPressedChange={() => editor.chain().focus().toggleHighlight().run()}
        className="h-7 w-7 p-0"
      >
        <Highlighter className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('link')}
        onPressedChange={addLink}
        className="h-7 w-7 p-0"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </Toggle>
    </BubbleMenu>
  );
}
