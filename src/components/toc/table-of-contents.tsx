'use client';

import { useState, useEffect, useMemo } from 'react';
import { List } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Editor } from '@tiptap/react';

interface TocItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

interface TableOfContentsProps {
  editor: Editor | null;
}

export function TableOfContents({ editor }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const items: TocItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const id = `heading-${pos}`;
          items.push({
            id,
            level: node.attrs.level,
            text: node.textContent,
            pos,
          });
        }
      });
      setHeadings(items);
    };

    updateHeadings();
    editor.on('update', updateHeadings);
    return () => {
      editor.off('update', updateHeadings);
    };
  }, [editor]);

  const handleClick = (heading: TocItem) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(heading.pos).scrollIntoView().run();
    setActiveId(heading.id);
  };

  if (headings.length === 0) return null;

  return (
    <div className="w-56 shrink-0">
      <div className="sticky top-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <List className="h-3.5 w-3.5" />
          ON THIS PAGE
        </div>
        <ScrollArea className="max-h-[calc(100vh-200px)]">
          <nav className="space-y-0.5">
            {headings.map((heading) => (
              <button
                key={heading.id}
                onClick={() => handleClick(heading)}
                className={`block w-full truncate rounded px-2 py-1 text-left text-xs transition-colors hover:bg-accent/50 ${
                  activeId === heading.id ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'
                }`}
                style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
              >
                {heading.text}
              </button>
            ))}
          </nav>
        </ScrollArea>
      </div>
    </div>
  );
}
