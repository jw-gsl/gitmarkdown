'use client';

import { type Editor } from '@tiptap/react';
import { Pencil, MessageCircle, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useRef, useCallback } from 'react';

export interface SelectionData {
  text: string;
  from: number;
  to: number;
}

interface EditorBubbleMenuProps {
  /** Tiptap editor instance (markdown mode) */
  editor?: Editor;
  /** Container element ref (generic text mode — code viewer, etc.) */
  containerRef?: React.RefObject<HTMLElement | null>;
  onEdit?: (data: SelectionData) => void;
  onChat?: (data: SelectionData) => void;
  onComment?: (data: SelectionData) => void;
}

/** Threshold in px: if the selection rect top is less than this, flip menu below */
const FLIP_THRESHOLD = 80;
/** Gap between the selection and the menu */
const MENU_GAP = 8;

/** Get selection data from a Tiptap editor */
function getEditorSelectionData(editor: Editor): SelectionData | null {
  const { from, to } = editor.state.selection;
  if (from === to) return null;
  const text = editor.state.doc.textBetween(from, to, ' ');
  return { text, from, to };
}

/** Get selection data from a native textarea */
function getTextareaSelectionData(textarea: HTMLTextAreaElement): SelectionData | null {
  const { selectionStart, selectionEnd, value } = textarea;
  if (selectionStart === selectionEnd) return null;
  return { text: value.substring(selectionStart, selectionEnd), from: selectionStart, to: selectionEnd };
}

/** Get selection data from a native DOM selection within a container */
function getDomSelectionData(container: HTMLElement): SelectionData | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const text = sel.toString();
  if (!text.trim()) return null;
  // Calculate character offset within the container's text content
  const preRange = document.createRange();
  preRange.setStart(container, 0);
  preRange.setEnd(range.startContainer, range.startOffset);
  const from = preRange.toString().length;
  return { text, from, to: from + text.length };
}

export function EditorBubbleMenu({ editor, containerRef, onEdit, onChat, onComment }: EditorBubbleMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<SelectionData | null>(null);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── Positioning helper ──────────────────────────────────────────────
  const positionMenu = useCallback((rect: { top: number; bottom: number; left: number; width: number }) => {
    const menuEl = menuRef.current;
    const menuHeight = menuEl ? menuEl.offsetHeight : 40;
    const menuWidth = menuEl ? menuEl.offsetWidth : 300;

    const spaceAbove = rect.top;
    const shouldFlip = spaceAbove - menuHeight - MENU_GAP < FLIP_THRESHOLD;
    const top = shouldFlip
      ? rect.bottom + MENU_GAP
      : rect.top - menuHeight - MENU_GAP;

    let left = rect.left + rect.width / 2 - menuWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    setPosition({ top, left });
  }, []);

  // ── Tiptap mode ─────────────────────────────────────────────────────
  const updateTiptapPosition = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) { setVisible(false); return; }

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) { setVisible(false); return; }

    const range = domSelection.getRangeAt(0);
    const selectionRect = range.getBoundingClientRect();
    if (selectionRect.width === 0 && selectionRect.height === 0) { setVisible(false); return; }

    positionMenu(selectionRect);
    selectionRef.current = getEditorSelectionData(editor);
    setVisible(true);
  }, [editor, positionMenu]);

  useEffect(() => {
    if (!editor) return;
    const onSelectionUpdate = () => requestAnimationFrame(updateTiptapPosition);
    const onBlur = () => setVisible(false);
    editor.on('selectionUpdate', onSelectionUpdate);
    editor.on('blur', onBlur);
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate);
      editor.off('blur', onBlur);
    };
  }, [editor, updateTiptapPosition]);

  // ── Generic text mode ───────────────────────────────────────────────
  const updateGenericSelection = useCallback(() => {
    const container = containerRef?.current;
    if (!container) return;

    // Check textarea first
    const textarea = container.querySelector('textarea');
    if (textarea && document.activeElement === textarea) {
      const data = getTextareaSelectionData(textarea);
      if (data) {
        positionMenu({
          top: lastMousePos.current.y - 10,
          bottom: lastMousePos.current.y + 10,
          left: lastMousePos.current.x - 50,
          width: 100,
        });
        selectionRef.current = data;
        setVisible(true);
        return;
      }
    }

    // Check DOM selection (readonly <pre>)
    const data = getDomSelectionData(container);
    if (data) {
      const sel = window.getSelection()!;
      const range = sel.getRangeAt(0);
      positionMenu(range.getBoundingClientRect());
      selectionRef.current = data;
      setVisible(true);
      return;
    }

    setVisible(false);
    selectionRef.current = null;
  }, [containerRef, positionMenu]);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const onMouseUp = (e: MouseEvent) => {
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      setTimeout(updateGenericSelection, 10);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey || e.key === 'Shift') {
        updateGenericSelection();
      }
    };

    const onMouseDown = () => setVisible(false);

    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('keyup', onKeyUp);
    container.addEventListener('mousedown', onMouseDown);
    return () => {
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('mousedown', onMouseDown);
    };
  }, [containerRef, updateGenericSelection]);

  // ── Reposition on scroll/resize ─────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const handler = () => {
      requestAnimationFrame(editor ? updateTiptapPosition : updateGenericSelection);
    };
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [visible, editor, updateTiptapPosition, updateGenericSelection]);

  // ── Action handlers ─────────────────────────────────────────────────
  const handleEdit = () => {
    const data = editor ? getEditorSelectionData(editor) : selectionRef.current;
    if (!data) return;
    if (editor) {
      editor.chain().setHighlight({ color: '#FEF9C3' }).run();
      editor.commands.setTextSelection(data.to);
    }
    onEdit?.(data);
    setVisible(false);
  };

  const handleChat = () => {
    const data = editor ? getEditorSelectionData(editor) : selectionRef.current;
    if (!data) return;
    if (editor) {
      editor.commands.setTextSelection(data.to);
    }
    onChat?.(data);
    setVisible(false);
  };

  const handleComment = () => {
    const data = editor ? getEditorSelectionData(editor) : selectionRef.current;
    if (!data) return;
    if (editor) {
      editor.chain().setHighlight({ color: '#FEF9C3' }).run();
      editor.commands.setTextSelection(data.to);
    }
    onComment?.(data);
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
      onMouseDown={(e) => e.preventDefault()}
      data-testid="bubble-menu"
      role="toolbar"
      aria-label="Text actions for selected text"
    >
      <Button
        variant="ghost"
        className="text-sm gap-1.5 px-2.5 py-1.5 h-auto"
        onClick={handleEdit}
        data-testid="bubble-edit"
        aria-label="Edit selected text with AI"
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
        data-testid="bubble-chat"
        aria-label="Chat about selected text with AI"
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
        data-testid="bubble-comment"
        aria-label="Add comment on selected text"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Comment
        <kbd className="ml-1 text-[10px] text-muted-foreground/70 bg-muted px-1 rounded">⌘⇧M</kbd>
      </Button>
    </div>
  );
}
