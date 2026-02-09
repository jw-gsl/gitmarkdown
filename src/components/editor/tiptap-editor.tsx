'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import { useEffect, useCallback, useRef, useState } from 'react';
import { getEditorExtensions } from '@/lib/editor/config';
import { EditorToolbar } from './toolbar';
import { EditorBubbleMenu } from './bubble-menu';
import { SlashCommandMenu } from './slash-command';
import { InlineEditPanel } from './inline-edit-panel';
import { FindReplace } from './find-replace';
import { useUIStore } from '@/stores/ui-store';
import { useSettingsStore } from '@/stores/settings-store';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const activeCheck = useUIStore((s) => s.activeCheck);
  const setActiveCheck = useUIStore((s) => s.setActiveCheck);
  const setCheckActionResult = useUIStore((s) => s.setCheckActionResult);

  const editorFontSize = useSettingsStore((s) => s.editorFontSize);
  const editorLineHeight = useSettingsStore((s) => s.editorLineHeight);

  const [findOpen, setFindOpen] = useState(false);
  const [findMode, setFindMode] = useState<'find' | 'replace'>('find');
  const [findInitialQuery, setFindInitialQuery] = useState('');
  const [checkDiffPosition, setCheckDiffPosition] = useState<{ top: number; left: number } | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const suppressOnChangeRef = useRef(false);
  const checkInsertRef = useRef<{ matchFrom: number; matchTo: number; suggLen: number } | null>(null);
  const checkKeptRef = useRef(false);

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
      if (suppressOnChangeRef.current) return;
      if (onChange) {
        const storage = editor.storage as Record<string, any>;
        const markdown = storage.markdown?.getMarkdown() || '';
        onChange(markdown);
      }
    },
  });

  // Remove highlight when a comment is cancelled (pendingComment went null without saving)
  const prevPendingComment = useRef(pendingComment);
  useEffect(() => {
    if (prevPendingComment.current && !pendingComment && editor) {
      const { from, to } = prevPendingComment.current;
      // Guard: positions must be within document bounds
      const docSize = editor.state.doc.content.size;
      if (from >= 0 && to <= docSize && from < to) {
        try {
          const text = editor.state.doc.textBetween(from, to);
          // Only remove if this text is NOT an existing comment anchor
          if (!commentAnchors?.includes(text)) {
            editor
              .chain()
              .setTextSelection({ from, to })
              .unsetHighlight()
              .setTextSelection(to)
              .run();
          }
        } catch {
          // positions may be stale after edits — ignore
        }
      }
    }
    prevPendingComment.current = pendingComment;
  }, [pendingComment, editor, commentAnchors]);

  useEffect(() => {
    if (editor && content !== (editor.storage as Record<string, any>).markdown?.getMarkdown()) {
      editor.commands.setContent(content);
      // Reset so highlights get re-applied after content change
      prevAnchorsRef.current = [];
    }
  }, [content, editor]);

  // Sync yellow highlights with current active comment anchors.
  // Runs on every commentAnchors change: removes stale highlights (e.g. resolved comments)
  // and adds marks for new ones.
  const prevAnchorsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!editor) return;
    if (editor.state.doc.textContent.length === 0) return;

    const highlightType = editor.schema.marks.highlight;
    if (!highlightType) return;

    const anchors = commentAnchors ?? [];
    const anchorSet = new Set(anchors);
    const prevSet = new Set(prevAnchorsRef.current);

    // Skip if nothing changed
    if (anchors.length === prevAnchorsRef.current.length && anchors.every((a) => prevSet.has(a))) return;
    prevAnchorsRef.current = anchors;

    const mark = highlightType.create({ color: '#FEF9C3' });
    const { tr } = editor.state;

    // First pass: remove highlight marks for text that is no longer an active anchor
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      node.marks.forEach((m) => {
        if (m.type.name === 'highlight' && m.attrs.color === '#FEF9C3') {
          // Check if this text range still matches an active anchor
          const text = node.text!;
          const isStillActive = anchors.some((anchor) => text.includes(anchor));
          if (!isStillActive) {
            tr.removeMark(pos, pos + node.nodeSize, m);
          }
        }
      });
    });

    // Second pass: add highlights for active anchors
    const applied = new Set<string>();
    anchors.forEach((anchorText) => {
      if (!anchorText || applied.has(anchorText)) return;
      applied.add(anchorText);

      editor.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        let startIdx = 0;
        while (true) {
          const idx = node.text!.indexOf(anchorText, startIdx);
          if (idx === -1) break;
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

  // Inline check diff: red mark on old text + green suggestion text inserted natively
  useEffect(() => {
    if (!editor || !activeCheck) {
      setCheckDiffPosition(null);
      return;
    }
    const dom = editor.view.dom;
    const highlightType = editor.schema.marks.highlight;
    if (!highlightType) return;

    const searchText = activeCheck.text;
    let matchFrom = -1;
    let matchTo = -1;

    // Search across potentially fragmented text nodes (mark add/remove can split nodes)
    const textNodes: Array<{ text: string; pos: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        textNodes.push({ text: node.text, pos });
      }
    });

    for (let start = 0; start < textNodes.length && matchFrom === -1; start++) {
      let combined = '';
      for (let end = start; end < textNodes.length; end++) {
        if (end > start) {
          const prev = textNodes[end - 1];
          if (prev.pos + prev.text.length !== textNodes[end].pos) break;
        }
        combined += textNodes[end].text;
        const idx = combined.indexOf(searchText);
        if (idx !== -1) {
          matchFrom = textNodes[start].pos + idx;
          matchTo = matchFrom + searchText.length;
          break;
        }
      }
    }

    if (matchFrom === -1) {
      setCheckDiffPosition(null);
      return;
    }

    const suggLen = activeCheck.suggestion.length;
    checkInsertRef.current = { matchFrom, matchTo, suggLen };
    checkKeptRef.current = false;

    // Add red mark on old text + insert green suggestion text (suppressed from onChange + undo)
    const redMark = highlightType.create({ color: '#fecaca' });
    const greenMark = highlightType.create({ color: '#bbf7d0' });
    const suggNode = editor.schema.text(activeCheck.suggestion, [greenMark]);

    suppressOnChangeRef.current = true;
    const { tr } = editor.state;
    tr.setMeta('addToHistory', false);
    tr.addMark(matchFrom, matchTo, redMark);
    tr.insert(matchTo, suggNode);
    editor.view.dispatch(tr);
    suppressOnChangeRef.current = false;

    // Scroll into view and position action buttons below the suggestion text
    requestAnimationFrame(() => {
      const greenEls = dom.querySelectorAll('mark[data-color="#bbf7d0"]');
      const lastGreen = greenEls[greenEls.length - 1];
      const scrollTarget = lastGreen || dom.querySelector('mark[data-color="#fecaca"]');
      if (scrollTarget) {
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const wrapper = editorWrapperRef.current;
        if (wrapper) {
          const rect = scrollTarget.getBoundingClientRect();
          const wrapperRect = wrapper.getBoundingClientRect();
          setCheckDiffPosition({
            top: rect.bottom - wrapperRect.top + wrapper.scrollTop + 4,
            left: rect.left - wrapperRect.left,
          });
        }
      }
    });

    // Cleanup: remove inserted suggestion + red mark when activeCheck changes
    return () => {
      setCheckDiffPosition(null);
      checkInsertRef.current = null;
      if (!editor.isDestroyed && !checkKeptRef.current) {
        suppressOnChangeRef.current = true;
        const { tr: cleanTr } = editor.state;
        cleanTr.setMeta('addToHistory', false);
        cleanTr.delete(matchTo, matchTo + suggLen);
        cleanTr.removeMark(matchFrom, matchTo, redMark);
        editor.view.dispatch(cleanTr);
        suppressOnChangeRef.current = false;
      }
    };
  }, [editor, activeCheck]);

  // Keyboard shortcuts: ⌘E (edit), ⌘J (chat), ⌘⇧M (comment), ⌘F (find), ⌘H (replace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editor) return;

      // ⌘F or Ctrl+F → Find
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !e.shiftKey) {
        e.preventDefault();
        const { from, to } = editor.state.selection;
        const selectedText = from !== to ? editor.state.doc.textBetween(from, to, ' ') : '';
        setFindInitialQuery(selectedText);
        setFindMode('find');
        setFindOpen(true);
        return;
      }

      // ⌘H or Ctrl+H → Find & Replace
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        const { from, to } = editor.state.selection;
        const selectedText = from !== to ? editor.state.doc.textBetween(from, to, ' ') : '';
        setFindInitialQuery(selectedText);
        setFindMode('replace');
        setFindOpen(true);
        return;
      }

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

  // Inline check actions
  const handleKeepCheck = useCallback(() => {
    if (!editor || !checkInsertRef.current) return;
    const { matchFrom, matchTo, suggLen } = checkInsertRef.current;
    const highlightType = editor.schema.marks.highlight;
    if (!highlightType) return;

    checkKeptRef.current = true;
    const greenMark = highlightType.create({ color: '#bbf7d0' });
    const { tr } = editor.state;
    // Delete old text; suggestion shifts to matchFrom..matchFrom+suggLen
    tr.delete(matchFrom, matchTo);
    // Remove green mark from suggestion so it looks like normal text
    tr.removeMark(matchFrom, matchFrom + suggLen, greenMark);
    editor.view.dispatch(tr);
    // onChange fires naturally → updates content state, marks dirty

    if (activeCheck) setCheckActionResult({ index: activeCheck.index, action: 'keep' });
    setActiveCheck(null);
  }, [editor, activeCheck, setActiveCheck, setCheckActionResult]);

  const handleDismissCheck = useCallback(() => {
    if (activeCheck) setCheckActionResult({ index: activeCheck.index, action: 'dismiss' });
    setActiveCheck(null);
  }, [activeCheck, setActiveCheck, setCheckActionResult]);

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
    <div ref={editorWrapperRef} className={`relative min-h-full bg-accent/40 dark:bg-background ${className}`} data-testid="markdown-editor" id="tiptap-editor">
      <EditorBubbleMenu
        editor={editor}
        onEdit={handleEdit}
        onChat={onChat}
        onComment={onComment}
      />
      <div className="mx-auto max-w-3xl bg-background editor-page rounded-lg mb-8">
        <EditorToolbar editor={editor} />
        <div className="relative" style={{ fontSize: `${editorFontSize}px`, lineHeight: editorLineHeight }} data-testid="editor-content">
          {findOpen && (
            <FindReplace
              editor={editor}
              mode={findMode}
              initialQuery={findInitialQuery}
              onClose={() => setFindOpen(false)}
            />
          )}
          <EditorContent editor={editor} />
          <SlashCommandMenu editor={editor} />
        </div>
      </div>

      {/* Inline check action buttons */}
      {activeCheck && checkDiffPosition && (
        <div
          className="absolute z-40 flex items-center gap-1.5 rounded-md border bg-background/95 shadow-sm px-1.5 py-1 backdrop-blur-sm"
          style={{ top: checkDiffPosition.top, left: checkDiffPosition.left }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] px-2"
            onClick={handleDismissCheck}
          >
            <X className="h-3 w-3 mr-1" />
            Dismiss
          </Button>
          <Button
            size="sm"
            className="h-6 text-[11px] px-2"
            onClick={handleKeepCheck}
          >
            <Check className="h-3 w-3 mr-1" />
            Keep
          </Button>
        </div>
      )}

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
