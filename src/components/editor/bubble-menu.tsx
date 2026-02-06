'use client';

import { type Editor } from '@tiptap/react';
import { Pencil, MessageCircle, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useRef, useCallback } from 'react';

interface SelectionData {
  text: string;
  from: number;
  to: number;
}

interface EditorBubbleMenuProps {
  editor: Editor;
  onEdit?: (data: SelectionData) => void;
  onChat?: (data: SelectionData) => void;
  onComment?: (data: SelectionData) => void;
}

function getSelectionData(editor: Editor): SelectionData | null {
  const { from, to } = editor.state.selection;
  if (from === to) return null;
  const text = editor.state.doc.textBetween(from, to, ' ');
  return { text, from, to };
}

/** Threshold in px: if the selection rect top is less than this, flip menu below */
const FLIP_THRESHOLD = 80;
/** Gap between the selection and the menu */
const MENU_GAP = 8;

export function EditorBubbleMenu({ editor, onEdit, onChat, onComment }: EditorBubbleMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<'above' | 'below'>('above');
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const { from, to } = editor.state.selection;
    if (from === to) {
      setVisible(false);
      return;
    }

    // Get the DOM selection rect
    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      setVisible(false);
      return;
    }

    const range = domSelection.getRangeAt(0);
    const selectionRect = range.getBoundingClientRect();

    // If the rect has no dimensions, the selection isn't visible
    if (selectionRect.width === 0 && selectionRect.height === 0) {
      setVisible(false);
      return;
    }

    const menuEl = menuRef.current;
    const menuHeight = menuEl ? menuEl.offsetHeight : 40;
    const menuWidth = menuEl ? menuEl.offsetWidth : 300;

    // Determine placement: above or below
    const spaceAbove = selectionRect.top;
    const shouldFlip = spaceAbove - menuHeight - MENU_GAP < FLIP_THRESHOLD;

    let top: number;
    if (shouldFlip) {
      // Place below the selection
      top = selectionRect.bottom + MENU_GAP;
      setPlacement('below');
    } else {
      // Place above the selection
      top = selectionRect.top - menuHeight - MENU_GAP;
      setPlacement('above');
    }

    // Center horizontally on the selection, but keep within viewport
    let left = selectionRect.left + selectionRect.width / 2 - menuWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    setPosition({ top, left });
    setVisible(true);
  }, [editor]);

  useEffect(() => {
    // Listen for selection updates from the editor
    const onSelectionUpdate = () => {
      // Use requestAnimationFrame to let the DOM settle
      requestAnimationFrame(updatePosition);
    };

    const onBlur = () => setVisible(false);

    editor.on('selectionUpdate', onSelectionUpdate);
    editor.on('blur', onBlur);

    return () => {
      editor.off('selectionUpdate', onSelectionUpdate);
      editor.off('blur', onBlur);
    };
  }, [editor, updatePosition]);

  // Also reposition on scroll/resize while visible
  useEffect(() => {
    if (!visible) return;

    const onScrollOrResize = () => {
      requestAnimationFrame(updatePosition);
    };

    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [visible, updatePosition]);

  const handleEdit = () => {
    const data = getSelectionData(editor);
    if (!data) return;
    editor.chain().setHighlight({ color: '#FEF9C3' }).run();
    onEdit?.(data);
    editor.commands.setTextSelection(data.to);
    setVisible(false);
  };

  const handleChat = () => {
    const data = getSelectionData(editor);
    if (!data) return;
    onChat?.(data);
    editor.commands.setTextSelection(data.to);
    setVisible(false);
  };

  const handleComment = () => {
    const data = getSelectionData(editor);
    if (!data) return;
    editor.chain().setHighlight({ color: '#FEF9C3' }).run();
    onComment?.(data);
    editor.commands.setTextSelection(data.to);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border bg-background p-1 shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      // Prevent clicks on the menu from blurring the editor
      onMouseDown={(e) => e.preventDefault()}
    >
      <Button
        variant="ghost"
        className="text-sm gap-1.5 px-2.5 py-1.5 h-auto"
        onClick={handleEdit}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
        <kbd className="ml-1 text-[10px] text-muted-foreground/70 bg-muted px-1 rounded">⌘E</kbd>
      </Button>
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <Button
        variant="ghost"
        className="text-sm gap-1.5 px-2.5 py-1.5 h-auto"
        onClick={handleChat}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Chat
        <kbd className="ml-1 text-[10px] text-muted-foreground/70 bg-muted px-1 rounded">⌘J</kbd>
      </Button>
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <Button
        variant="ghost"
        className="text-sm gap-1.5 px-2.5 py-1.5 h-auto"
        onClick={handleComment}
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Comment
        <kbd className="ml-1 text-[10px] text-muted-foreground/70 bg-muted px-1 rounded">⌘⇧M</kbd>
      </Button>
    </div>
  );
}
