'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { type Editor } from '@tiptap/react';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Table,
  Image,
} from 'lucide-react';
import { slashCommandItems } from '@/lib/editor/extensions';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  H1: Heading1,
  H2: Heading2,
  H3: Heading3,
  List: List,
  ListOrdered: ListOrdered,
  CheckSquare: CheckSquare,
  Quote: Quote,
  Code: Code,
  Minus: Minus,
  Table: Table,
  Image: Image,
};

interface SlashCommandMenuProps {
  editor: Editor;
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredItems = slashCommandItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          // Delete the slash and query text
          const { from } = editor.state.selection;
          const textBefore = editor.state.doc.textBetween(Math.max(0, from - query.length - 1), from);
          editor.chain().focus().deleteRange({ from: from - query.length - 1, to: from }).run();
          item.command(editor);
          setIsOpen(false);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [isOpen, filteredItems, selectedIndex, editor, query]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const handleUpdate = () => {
      const { from, empty } = editor.state.selection;
      if (!empty) {
        setIsOpen(false);
        return;
      }

      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 20), from);
      const slashMatch = textBefore.match(/\/([a-zA-Z]*)$/);

      if (slashMatch) {
        setQuery(slashMatch[1]);
        setSelectedIndex(0);
        setIsOpen(true);

        // Get cursor position for menu placement
        const coords = editor.view.coordsAtPos(from);
        const editorRect = editor.view.dom.getBoundingClientRect();
        setPosition({
          top: coords.bottom - editorRect.top + 4,
          left: coords.left - editorRect.left,
        });
      } else {
        setIsOpen(false);
      }
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor]);

  if (!isOpen || filteredItems.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-72 rounded-lg border bg-popover p-1 shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {filteredItems.map((item, index) => {
        const Icon = iconMap[item.icon] || Code;
        return (
          <button
            key={item.title}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
            }`}
            onClick={() => {
              const { from } = editor.state.selection;
              editor.chain().focus().deleteRange({ from: from - query.length - 1, to: from }).run();
              item.command(editor);
              setIsOpen(false);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background">
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-left">
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
