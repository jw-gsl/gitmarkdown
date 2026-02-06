import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table';
import { TableHeader } from '@tiptap/extension-table';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

export function getEditorExtensions(options?: { placeholder?: string }) {
  return [
    StarterKit.configure({
      codeBlock: false,
    }),
    Placeholder.configure({
      placeholder: options?.placeholder || 'Type "/" for commands...',
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({ inline: true }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
    }),
    Highlight.configure({ multicolor: true }),
    Typography,
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    CodeBlockLowlight.configure({ lowlight }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Subscript,
    Superscript,
    TextStyle,
    Color,
  ];
}
