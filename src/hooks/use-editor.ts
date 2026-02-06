'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import type { EditorState } from '@/types';

export function useEditorState(editor: Editor | null) {
  const [state, setState] = useState<EditorState>({
    isReady: false,
    isDirty: false,
    wordCount: 0,
    characterCount: 0,
  });

  useEffect(() => {
    if (!editor) return;

    const updateState = () => {
      const text = editor.state.doc.textContent;
      setState({
        isReady: true,
        isDirty: false,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        characterCount: text.length,
      });
    };

    updateState();
    editor.on('update', updateState);
    return () => {
      editor.off('update', updateState);
    };
  }, [editor]);

  return state;
}

export function useAIEditShortcut(
  editor: Editor | null,
  onTrigger: (selectedText: string, context: string, position: { top: number; left: number }) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!editor) return;

        const { from, to, empty } = editor.state.selection;
        if (empty) return;

        const selectedText = editor.state.doc.textBetween(from, to);
        const contextStart = Math.max(0, from - 200);
        const contextEnd = Math.min(editor.state.doc.content.size, to + 200);
        const context = editor.state.doc.textBetween(contextStart, contextEnd);

        const coords = editor.view.coordsAtPos(from);
        const editorRect = editor.view.dom.getBoundingClientRect();

        onTrigger(selectedText, context, {
          top: coords.bottom - editorRect.top + 4,
          left: coords.left - editorRect.left,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, onTrigger]);
}
