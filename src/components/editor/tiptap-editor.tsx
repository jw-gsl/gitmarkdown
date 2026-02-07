'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import { useEffect, useCallback, useRef } from 'react';
import { getEditorExtensions } from '@/lib/editor/config';
import { EditorToolbar } from './toolbar';
import { EditorBubbleMenu } from './bubble-menu';
import { SlashCommandMenu } from './slash-command';
import { InlineEditPanel } from './inline-edit-panel';
import { useUIStore } from '@/stores/ui-store';
import { useSettingsStore } from '@/stores/settings-store';

interface SelectionData {
  text: string;
  from: number;
  to: number;
}

interface TiptapEditorProps {
  content: string;
  onChange?: (markdown: string) => void;
  onComment?: (data: SelectionData) => void;
  onChat?: (data: SelectionData) => void;
  onHighlightClick?: (data: SelectionData) => void;
  pendingComment?: { from: number; to: number } | null;
  commentAnchors?: string[];
  activeAnchorText?: string | null;
  editable?: boolean;
  className?: string;
  placeholder?: string;
}

export function TiptapEditor({
  content,
  onChange,
  onComment,
  onChat,
  onHighlightClick,
  pendingComment,
  commentAnchors,
  activeAnchorText,
  editable = true,
  className = '',
  placeholder,
}: TiptapEditorProps) {
  const onHighlightClickRef = useRef(onHighlightClick);
  onHighlightClickRef.current = onHighlightClick;
  const onCommentRef = useRef(onComment);
  onCommentRef.current = onComment;
  const onChatRef = useRef(onChat);
  onChatRef.current = onChat;

  const inlineEditSelection = useUIStore((s) => s.inlineEditSelection);
  const setInlineEditSelection = useUIStore((s) => s.setInlineEditSelection);

  const editorFontSize = useSettingsStore((s) => s.editorFontSize);
  const editorLineHeight = useSettingsStore((s) => s.editorLineHeight);

  const highlightsApplied = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
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
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] px-4 sm:px-8 py-4 sm:py-6',
      },
      handleClick: (view, pos) => {
        if (pos < 0 || pos > view.state.doc.content.size) return false;
        try {
          const $pos = view.state.doc.resolve(pos);
          // Check marks more robustly - nodeAfter, nodeBefore, and stored marks
          const allMarks = [
            ...($pos.nodeAfter?.marks ?? []),
            ...($pos.nodeBefore?.marks ?? []),
            ...$pos.marks(),
          ];
          const commentHighlight = allMarks.find(
            (m) => m.type.name === 'highlight' && m.attrs.color === '#FEF9C3'
          );
          if (commentHighlight && onHighlightClickRef.current) {
            const parent = $pos.parent;
            const parentStart = $pos.start();
            let from = pos;
            let to = pos;

            parent.forEach((node, offset) => {
              const nodeStart = parentStart + offset;
              const nodeEnd = nodeStart + node.nodeSize;
              if (nodeStart <= pos && pos < nodeEnd) {
                if (node.marks.some((m) => m.type.name === 'highlight' && m.attrs.color === '#FEF9C3')) {
                  from = nodeStart;
                  to = nodeEnd;
                }
              }
            });

            let extended = true;
            while (extended) {
              extended = false;
              parent.forEach((node, offset) => {
                const nodeStart = parentStart + offset;
                const nodeEnd = nodeStart + node.nodeSize;
                if (nodeEnd === from && node.marks.some((m) => m.type.name === 'highlight' && m.attrs.color === '#FEF9C3')) {
                  from = nodeStart;
                  extended = true;
                }
                if (nodeStart === to && node.marks.some((m) => m.type.name === 'highlight' && m.attrs.color === '#FEF9C3')) {
                  to = nodeEnd;
                  extended = true;
                }
              });
            }

            const text = view.state.doc.textBetween(from, to, ' ');
            onHighlightClickRef.current({ text, from, to });
          }
        } catch {
          // Position may be invalid
        }
        return false;
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

  // Comment highlights persist — we do NOT clear them when pendingComment goes null
  // (the yellow highlight marks where comments are anchored)

  useEffect(() => {
    if (editor && content !== (editor.storage as Record<string, any>).markdown?.getMarkdown()) {
      editor.commands.setContent(content);
      // Reset so highlights get re-applied after content change
      highlightsApplied.current = false;
    }
  }, [content, editor]);

  // Apply yellow highlights for all existing comment anchors on load
  useEffect(() => {
    if (!editor || !commentAnchors?.length || highlightsApplied.current) return;
    if (editor.state.doc.textContent.length === 0) return;

    highlightsApplied.current = true;

    const highlightType = editor.schema.marks.highlight;
    if (!highlightType) return;
    const mark = highlightType.create({ color: '#FEF9C3' });
    const { tr } = editor.state;

    const applied = new Set<string>();
    commentAnchors.forEach((anchorText) => {
      if (!anchorText || applied.has(anchorText)) return;
      applied.add(anchorText);

      editor.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        let startIdx = 0;
        while (true) {
          const idx = node.text!.indexOf(anchorText, startIdx);
          if (idx === -1) break;
          // Check if already has highlight mark
          const from = pos + idx;
          const to = from + anchorText.length;
          const $from = editor.state.doc.resolve(from);
          const hasHighlight = $from.marks().some(
            (m) => m.type.name === 'highlight' && m.attrs.color === '#FEF9C3'
          );
          if (!hasHighlight) {
            tr.addMark(from, to, mark);
          }
          startIdx = idx + 1;
        }
      });
    });

    if (tr.docChanged) {
      editor.view.dispatch(tr);
    }
  }, [editor, commentAnchors]);

  // Toggle active highlight class on the selected comment's anchor text
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    const applyActiveClass = () => {
      // Clear all previous active highlights
      dom.querySelectorAll('mark.comment-active').forEach((el) => {
        el.classList.remove('comment-active');
      });

      if (!activeAnchorText) return;

      const highlightType = editor.schema.marks.highlight;
      if (!highlightType) return;

      // Group consecutive highlighted text nodes from the ProseMirror doc.
      // This handles anchor text that spans multiple marks (e.g. bold formatting).
      interface HLSpan { text: string; pos: number; nodeSize: number; }
      const groups: HLSpan[][] = [];
      let currentGroup: HLSpan[] = [];
      let lastEnd = -1;

      editor.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;

        const hasHL = node.marks.some(
          (m) => m.type === highlightType && m.attrs.color === '#FEF9C3'
        );

        if (hasHL) {
          if (pos === lastEnd && currentGroup.length > 0) {
            currentGroup.push({ text: node.text, pos, nodeSize: node.nodeSize });
          } else {
            if (currentGroup.length > 0) groups.push(currentGroup);
            currentGroup = [{ text: node.text, pos, nodeSize: node.nodeSize }];
          }
          lastEnd = pos + node.nodeSize;
        } else {
          if (currentGroup.length > 0) groups.push(currentGroup);
          currentGroup = [];
          lastEnd = -1;
        }
      });
      if (currentGroup.length > 0) groups.push(currentGroup);

      // Find the group whose combined text contains activeAnchorText
      for (const group of groups) {
        const combinedText = group.map((s) => s.text).join('');
        if (!combinedText.includes(activeAnchorText)) continue;

        // Map each ProseMirror text node to its DOM <mark> element
        for (const span of group) {
          try {
            const { node: domNode } = editor.view.domAtPos(span.pos);
            let el: Node | null = domNode;
            if (el?.nodeType === Node.TEXT_NODE) el = el.parentElement;
            while (el && el !== dom) {
              if (el instanceof HTMLElement && el.tagName === 'MARK') {
                el.classList.add('comment-active');
                break;
              }
              el = (el as HTMLElement).parentElement;
            }
          } catch {
            // Position may not map to DOM
          }
        }
        break; // Only highlight first matching group
      }
    };

    applyActiveClass();

    // Re-apply after editor updates since ProseMirror may recreate DOM nodes
    editor.on('update', applyActiveClass);
    return () => {
      editor.off('update', applyActiveClass);
      dom.querySelectorAll('mark.comment-active').forEach((el) => {
        el.classList.remove('comment-active');
      });
    };
  }, [editor, activeAnchorText]);

  // Keyboard shortcuts: ⌘E (edit), ⌘J (chat), ⌘⇧M (comment)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      if (from === to) return; // No selection

      const text = editor.state.doc.textBetween(from, to, ' ');
      const data = { text, from, to };

      // ⌘E or Ctrl+E → Edit
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        editor.chain().setHighlight({ color: '#FEF9C3' }).run();
        setInlineEditSelection(data);
        editor.commands.setTextSelection(to);
        return;
      }

      // ⌘J or Ctrl+J → Chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        onChatRef.current?.(data);
        editor.commands.setTextSelection(to);
        return;
      }

      // ⌘⇧M or Ctrl+Shift+M → Comment
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'm') {
        e.preventDefault();
        editor.chain().setHighlight({ color: '#FEF9C3' }).run();
        onCommentRef.current?.(data);
        editor.commands.setTextSelection(to);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, setInlineEditSelection]);

  // Handle edit actions
  const handleEdit = useCallback(
    (data: SelectionData) => {
      setInlineEditSelection(data);
    },
    [setInlineEditSelection]
  );

  const handleEditAccept = useCallback(
    (newText: string) => {
      if (!editor || !inlineEditSelection) return;
      const { from, to } = inlineEditSelection;
      try {
        const docSize = editor.state.doc.content.size;
        const safeTo = Math.min(to, docSize);
        const safeFrom = Math.min(from, safeTo);
        editor.chain()
          .focus()
          .setTextSelection({ from: safeFrom, to: safeTo })
          .unsetHighlight()
          .setTextSelection({ from: safeFrom, to: safeTo })
          .insertContent(newText)
          .run();
      } catch {
        // Range may have shifted
      }
      setInlineEditSelection(null);
    },
    [editor, inlineEditSelection, setInlineEditSelection]
  );

  const handleEditReject = useCallback(() => {
    if (editor && inlineEditSelection) {
      const { from, to } = inlineEditSelection;
      try {
        const docSize = editor.state.doc.content.size;
        const safeTo = Math.min(to, docSize);
        const safeFrom = Math.min(from, safeTo);
        editor.chain()
          .setTextSelection({ from: safeFrom, to: safeTo })
          .unsetHighlight()
          .setTextSelection(safeTo)
          .run();
      } catch {
        // Range may have shifted
      }
    }
    setInlineEditSelection(null);
  }, [editor, inlineEditSelection, setInlineEditSelection]);

  const handleEditClose = useCallback(() => {
    if (editor && inlineEditSelection) {
      const { from, to } = inlineEditSelection;
      try {
        const docSize = editor.state.doc.content.size;
        const safeTo = Math.min(to, docSize);
        const safeFrom = Math.min(from, safeTo);
        editor.chain()
          .setTextSelection({ from: safeFrom, to: safeTo })
          .unsetHighlight()
          .setTextSelection(safeTo)
          .run();
      } catch {
        // Range may have shifted
      }
    }
    setInlineEditSelection(null);
  }, [editor, inlineEditSelection, setInlineEditSelection]);

  // Get context around the selection for AI
  const getEditContext = useCallback((): string => {
    if (!editor || !inlineEditSelection) return '';
    try {
      const { from, to } = inlineEditSelection;
      const docSize = editor.state.doc.content.size;
      const contextFrom = Math.max(0, from - 500);
      const contextTo = Math.min(docSize, to + 500);
      return editor.state.doc.textBetween(contextFrom, contextTo, '\n');
    } catch {
      return '';
    }
  }, [editor, inlineEditSelection]);

  if (!editor) return null;

  return (
    <div className={`relative min-h-full bg-accent/40 dark:bg-neutral-950 ${className}`}>
      <EditorBubbleMenu
        editor={editor}
        onEdit={handleEdit}
        onChat={onChat}
        onComment={onComment}
      />
      <div className="mx-auto max-w-3xl bg-background editor-page rounded-lg mb-8">
        <EditorToolbar editor={editor} />
        <div className="relative" style={{ fontSize: `${editorFontSize}px`, lineHeight: editorLineHeight }}>
          <EditorContent editor={editor} />
          <SlashCommandMenu editor={editor} />
        </div>
      </div>

      {/* Inline AI edit panel */}
      {inlineEditSelection && (
        <InlineEditPanel
          selectedText={inlineEditSelection.text}
          selectionFrom={inlineEditSelection.from}
          selectionTo={inlineEditSelection.to}
          context={getEditContext()}
          onAccept={handleEditAccept}
          onReject={handleEditReject}
          onClose={handleEditClose}
        />
      )}
    </div>
  );
}
