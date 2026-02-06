import { Extension } from '@tiptap/core';
import { type Editor } from '@tiptap/react';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: (editor: Editor) => void;
}

export const slashCommandItems: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: 'List',
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: 'ListOrdered',
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: 'Task List',
    description: 'Create a to-do list with checkboxes',
    icon: 'CheckSquare',
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: 'Blockquote',
    description: 'Add a blockquote',
    icon: 'Quote',
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: 'Code Block',
    description: 'Add a code block with syntax highlighting',
    icon: 'Code',
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Divider',
    description: 'Add a horizontal divider',
    icon: 'Minus',
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: 'Table',
    description: 'Add a table',
    icon: 'Table',
    command: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Image',
    description: 'Add an image from URL',
    icon: 'Image',
    command: (editor) => {
      const url = window.prompt('Image URL');
      if (url) editor.chain().focus().setImage({ src: url }).run();
    },
  },
];
