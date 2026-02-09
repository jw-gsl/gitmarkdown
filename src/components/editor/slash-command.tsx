'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  FileText,
  Settings,
} from 'lucide-react';
import { slashCommandItems, type SlashCommandItem } from '@/lib/editor/extensions';
import { useSettingsStore } from '@/stores/settings-store';
import { useUIStore } from '@/stores/ui-store';

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
  FileText: FileText,
  Settings: Settings,
};

interface SlashCommandMenuProps {
  editor: Editor;
}

interface DisplayItem extends SlashCommandItem {
  isSnippet?: boolean;
  isSeparator?: boolean;
  isAction?: boolean;
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const customSnippets = useSettingsStore((s) => s.customSnippets);
  const openSettingsDialog = useUIStore((s) => s.openSettingsDialog);

  const allItems = useMemo(() => {
    const snippetItems: DisplayItem[] = customSnippets.map((snippet) => ({
      title: snippet.title,
      description: `/${snippet.trigger}`,
      icon: 'FileText',
      isSnippet: true,
      command: (ed: Editor) => {
        ed.chain().focus().insertContent(snippet.content).run();
      },
    }));

    const manageItem: DisplayItem = {
      title: customSnippets.length > 0 ? 'Manage Snippets' : 'Create Snippet',
      description: 'Open settings to add or edit snippets',
      icon: 'Settings',
      isAction: true,
      command: () => {
        openSettingsDialog('snippets');
      },
    };

    return { commands: slashCommandItems as DisplayItem[], snippets: snippetItems, manageItem };
  }, [customSnippets, openSettingsDialog]);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    const filteredCommands = allItems.commands.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
    const filteredSnippets = allItems.snippets.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );

    // Show manage/create action if query matches or if query is empty
    const manageMatches =
      !q ||
      allItems.manageItem.title.toLowerCase().includes(q) ||
      'snippet'.includes(q);

    const snippetSection: DisplayItem[] = [];
    if (filteredSnippets.length > 0 || manageMatches) {
      if (filteredCommands.length > 0) {
        snippetSection.push({
          title: '---',
          description: '',
          icon: '',
          isSeparator: true,
          command: () => {},
        } as DisplayItem);
      }
      snippetSection.push(...filteredSnippets);
      if (manageMatches) {
        snippetSection.push(allItems.manageItem);
      }
    }

    return [...filteredCommands, ...snippetSection];
  }, [query, allItems]);

  const selectableItems = filteredItems.filter((item) => !item.isSeparator);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const selectedEl = menuRef.current.querySelector('[aria-selected="true"]');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  const executeItem = useCallback(
    (item: DisplayItem) => {
      if (item.isAction) {
        // For action items (Manage Snippets), just close menu and delete slash text, then run
        const { from } = editor.state.selection;
        editor.chain().focus().deleteRange({ from: from - query.length - 1, to: from }).run();
        setIsOpen(false);
        item.command(editor);
      } else {
        const { from } = editor.state.selection;
        editor.chain().focus().deleteRange({ from: from - query.length - 1, to: from }).run();
        item.command(editor);
        setIsOpen(false);
      }
    },
    [editor, query]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % selectableItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + selectableItems.length) % selectableItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const item = selectableItems[selectedIndex];
        if (item) {
          executeItem(item);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    },
    [isOpen, selectableItems, selectedIndex, executeItem]
  );

  // Use capture phase on the editor DOM to intercept keys before ProseMirror handles them
  useEffect(() => {
    const dom = editor.view.dom;
    dom.addEventListener('keydown', handleKeyDown, true);
    return () => dom.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown, editor]);

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

  if (!isOpen || selectableItems.length === 0) return null;

  // Track the selectable index for each displayed item
  let selectableIdx = 0;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-72 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
      style={{ top: position.top, left: position.left }}
      data-testid="slash-command-menu"
      role="listbox"
      aria-label="Slash command menu — insert blocks and snippets"
    >
      {filteredItems.map((item, displayIndex) => {
        if (item.isSeparator) {
          return (
            <div
              key="separator"
              className="my-1 border-t border-border"
              role="separator"
            >
              <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Snippets
              </div>
            </div>
          );
        }

        const currentSelectableIdx = selectableIdx;
        selectableIdx++;

        const Icon = iconMap[item.icon] || Code;
        return (
          <button
            key={`${item.isSnippet ? 'snippet-' : ''}${item.isAction ? 'action-' : ''}${item.title}`}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              currentSelectableIdx === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
            } ${item.isAction ? 'opacity-70' : ''}`}
            onClick={() => executeItem(item)}
            onMouseEnter={() => setSelectedIndex(currentSelectableIdx)}
            data-testid={`slash-command-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            role="option"
            aria-selected={currentSelectableIdx === selectedIndex}
            aria-label={`${item.title}: ${item.description}`}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-md border bg-background ${item.isAction ? 'border-dashed' : ''}`}>
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
