'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { type Editor } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  X,
  ChevronDown,
  ChevronUp,
  CaseSensitive,
  Regex,
  Replace,
  ReplaceAll,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';

interface FindReplaceProps {
  editor: Editor;
  mode: 'find' | 'replace';
  initialQuery?: string;
  onClose: () => void;
}

interface SearchMatch {
  from: number;
  to: number;
}

const SEARCH_PLUGIN_KEY = new PluginKey('findReplace');

function findMatches(
  doc: any,
  searchTerm: string,
  caseSensitive: boolean,
  useRegex: boolean
): SearchMatch[] {
  if (!searchTerm) return [];

  const matches: SearchMatch[] = [];
  const textContent = doc.textContent;

  if (useRegex) {
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(searchTerm, flags);
      // Walk through text nodes to map string offsets to doc positions
      const textNodes: { pos: number; text: string; start: number }[] = [];
      let offset = 0;
      doc.descendants((node: any, pos: number) => {
        if (node.isText && node.text) {
          textNodes.push({ pos, text: node.text, start: offset });
          offset += node.text.length;
        }
      });

      let match;
      while ((match = regex.exec(textContent)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;

        // Map string offset to doc position
        let from = -1;
        let to = -1;
        for (const tn of textNodes) {
          const tnEnd = tn.start + tn.text.length;
          if (from === -1 && matchStart >= tn.start && matchStart < tnEnd) {
            from = tn.pos + (matchStart - tn.start);
          }
          if (matchEnd >= tn.start && matchEnd <= tnEnd) {
            to = tn.pos + (matchEnd - tn.start);
            break;
          }
        }
        if (from !== -1 && to !== -1) {
          matches.push({ from, to });
        }
      }
    } catch {
      // Invalid regex — return no matches
    }
  } else {
    // Plain text search using doc.descendants for accurate positions
    const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    doc.descendants((node: any, pos: number) => {
      if (!node.isText || !node.text) return;
      const text = caseSensitive ? node.text : node.text.toLowerCase();
      let startIdx = 0;
      while (true) {
        const idx = text.indexOf(term, startIdx);
        if (idx === -1) break;
        matches.push({ from: pos + idx, to: pos + idx + searchTerm.length });
        startIdx = idx + 1;
      }
    });
  }

  return matches;
}

export function FindReplace({ editor, mode: initialMode, initialQuery, onClose }: FindReplaceProps) {
  const [query, setQuery] = useState(initialQuery || '');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(initialMode === 'replace');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const pluginAdded = useRef(false);
  const matchesRef = useRef<SearchMatch[]>([]);
  const activeIndexRef = useRef(0);

  // Keep refs in sync
  matchesRef.current = matches;
  activeIndexRef.current = activeIndex;

  // Focus search input on mount
  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 50);
  }, []);

  // Compute matches whenever query, case sensitivity, regex, or doc changes
  const updateMatches = useCallback(() => {
    const found = findMatches(editor.state.doc, query, caseSensitive, useRegex);
    setMatches(found);
    // Clamp active index
    if (found.length === 0) {
      setActiveIndex(0);
    } else {
      setActiveIndex((prev) => Math.min(prev, found.length - 1));
    }
  }, [editor, query, caseSensitive, useRegex]);

  useEffect(() => {
    updateMatches();
  }, [updateMatches]);

  // Listen for doc changes to re-run search
  useEffect(() => {
    const handler = () => updateMatches();
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor, updateMatches]);

  // Register ProseMirror plugin for decorations
  useEffect(() => {
    if (pluginAdded.current) return;
    pluginAdded.current = true;

    const plugin = new Plugin({
      key: SEARCH_PLUGIN_KEY,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, old) => {
          // Check metadata for our updates
          const meta = tr.getMeta(SEARCH_PLUGIN_KEY);
          if (meta) return meta;
          if (tr.docChanged) return old.map(tr.mapping, tr.doc);
          return old;
        },
      },
      props: {
        decorations(state) {
          return SEARCH_PLUGIN_KEY.getState(state);
        },
      },
    });

    editor.registerPlugin(plugin);

    return () => {
      try {
        editor.unregisterPlugin(SEARCH_PLUGIN_KEY);
      } catch {
        // Plugin may already be unregistered
      }
      pluginAdded.current = false;
    };
  }, [editor]);

  // Update decorations whenever matches or activeIndex changes
  useEffect(() => {
    const decorations = matches.map((m, i) =>
      Decoration.inline(m.from, m.to, {
        class: i === activeIndex ? 'search-match search-match-active' : 'search-match',
      })
    );
    const decorationSet = DecorationSet.create(
      editor.state.doc,
      decorations
    );

    const tr = editor.state.tr.setMeta(SEARCH_PLUGIN_KEY, decorationSet);
    editor.view.dispatch(tr);
  }, [editor, matches, activeIndex]);

  // Clear decorations on unmount
  useEffect(() => {
    return () => {
      try {
        const tr = editor.state.tr.setMeta(SEARCH_PLUGIN_KEY, DecorationSet.empty);
        editor.view.dispatch(tr);
      } catch {
        // Editor may be destroyed
      }
    };
  }, [editor]);

  // Scroll active match into view
  useEffect(() => {
    if (matches.length === 0 || activeIndex >= matches.length) return;
    const match = matches[activeIndex];
    try {
      const coords = editor.view.coordsAtPos(match.from);
      const editorDom = editor.view.dom.closest('.overflow-auto');
      if (editorDom) {
        const rect = editorDom.getBoundingClientRect();
        if (coords.top < rect.top + 60 || coords.top > rect.bottom - 40) {
          const domAtPos = editor.view.domAtPos(match.from);
          if (domAtPos.node instanceof HTMLElement) {
            domAtPos.node.scrollIntoView({ block: 'center', behavior: 'smooth' });
          } else if (domAtPos.node.parentElement) {
            domAtPos.node.parentElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }
      }
    } catch {
      // Position may not map to DOM
    }
  }, [editor, matches, activeIndex]);

  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % matches.length);
  }, [matches.length]);

  const goToPrev = useCallback(() => {
    if (matches.length === 0) return;
    setActiveIndex((prev) => (prev - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const handleReplace = useCallback(() => {
    if (matches.length === 0 || activeIndex >= matches.length) return;
    const match = matches[activeIndex];
    editor.chain()
      .focus()
      .setTextSelection({ from: match.from, to: match.to })
      .insertContent(replaceText)
      .run();
  }, [editor, matches, activeIndex, replaceText]);

  const handleReplaceAll = useCallback(() => {
    if (matches.length === 0) return;
    // Replace from end to start to preserve positions
    const sorted = [...matches].sort((a, b) => b.from - a.from);
    const { tr } = editor.state;
    for (const match of sorted) {
      if (replaceText) {
        tr.replaceWith(match.from, match.to, editor.state.schema.text(replaceText));
      } else {
        tr.delete(match.from, match.to);
      }
    }
    editor.view.dispatch(tr);
  }, [editor, matches, replaceText]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        goToPrev();
      }
    },
    [onClose, goToNext, goToPrev]
  );

  // When initialMode changes to replace, show replace section
  useEffect(() => {
    if (initialMode === 'replace' && !showReplace) {
      setShowReplace(true);
      setTimeout(() => replaceInputRef.current?.focus(), 50);
    }
  }, [initialMode]);

  // Update query when initialQuery changes (e.g., new selection)
  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  return (
    <div
      className="absolute top-2 right-4 z-50 rounded-lg border bg-background shadow-lg"
      style={{ minWidth: 320 }}
      onKeyDown={handleKeyDown}
    >
      {/* Find row */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setShowReplace(!showReplace)}
          aria-label={showReplace ? 'Hide replace' : 'Show replace'}
        >
          {showReplace ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>

        <Input
          ref={searchInputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find"
          className="h-7 text-sm flex-1 min-w-0"
          aria-label="Search query"
        />

        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap px-1 shrink-0">
          {matches.length > 0 ? `${activeIndex + 1} of ${matches.length}` : 'No results'}
        </span>

        <Toggle
          size="sm"
          pressed={caseSensitive}
          onPressedChange={() => setCaseSensitive(!caseSensitive)}
          className="h-6 w-6 p-0 shrink-0"
          aria-label="Case sensitive"
        >
          <CaseSensitive className="h-3.5 w-3.5" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={useRegex}
          onPressedChange={() => setUseRegex(!useRegex)}
          className="h-6 w-6 p-0 shrink-0"
          aria-label="Use regular expression"
        >
          <Regex className="h-3.5 w-3.5" />
        </Toggle>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={goToPrev}
          disabled={matches.length === 0}
          aria-label="Previous match"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={goToNext}
          disabled={matches.length === 0}
          aria-label="Next match"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
          aria-label="Close find"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className="flex items-center gap-1 px-2 pb-1.5">
          {/* Spacer to align with search input */}
          <div className="w-6 shrink-0" />

          <Input
            ref={replaceInputRef}
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace"
            className="h-7 text-sm flex-1 min-w-0"
            aria-label="Replace text"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleReplace();
              }
            }}
          />

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleReplace}
            disabled={matches.length === 0}
            aria-label="Replace"
            title="Replace"
          >
            <Replace className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleReplaceAll}
            disabled={matches.length === 0}
            aria-label="Replace all"
            title="Replace all"
          >
            <ReplaceAll className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
