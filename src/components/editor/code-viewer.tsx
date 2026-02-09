'use client';

import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getShikiHighlighter, getShikiHighlighterSync, highlightCode } from '@/lib/editor/shiki';
import type { CodeThemeKey } from '@/lib/editor/shiki';
import { getLanguageForFile } from '@/lib/editor/file-utils';
import { useSettingsStore } from '@/stores/settings-store';
import { useUIStore } from '@/stores/ui-store';
import { processCompletion } from '@/lib/editor/completion-filters';

interface CodeViewerProps {
  content: string;
  filename: string;
  onChange?: (content: string) => void;
  commentAnchors?: string[];
  activeAnchorText?: string | null;
  onHighlightClick?: (data: { text: string; from: number; to: number }) => void;
}

/** Find which lines (0-indexed) contain ALL occurrences of a given text substring */
function findLinesForText(content: string, text: string): Set<number> {
  const lines = new Set<number>();
  if (!text || !content) return lines;
  let searchFrom = 0;
  while (searchFrom < content.length) {
    const idx = content.indexOf(text, searchFrom);
    if (idx === -1) break;
    const before = content.slice(0, idx);
    const startLine = before.split('\n').length - 1;
    const matchLines = text.split('\n').length;
    for (let i = startLine; i < startLine + matchLines; i++) {
      lines.add(i);
    }
    searchFrom = idx + 1;
  }
  return lines;
}

export function CodeViewer({ content, filename, onChange, commentAnchors, activeAnchorText, onHighlightClick }: CodeViewerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const codeTheme = useSettingsStore((s) => s.codeTheme);
  const tabCompletionsEnabled = useSettingsStore((s) => s.tabCompletionsEnabled);

  // UI store: active check for inline highlighting
  const activeCheck = useUIStore((s) => s.activeCheck);
  const setActiveCheck = useUIStore((s) => s.setActiveCheck);
  const setCheckActionResult = useUIStore((s) => s.setCheckActionResult);

  // Ghost text state
  const [ghostText, setGhostText] = useState<string | null>(null);
  const [ghostCursorPos, setGhostCursorPos] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  // Load shiki highlighter (singleton — only loads once)
  const [highlighter, setHighlighter] = useState(getShikiHighlighterSync);
  useEffect(() => {
    if (highlighter) return;
    getShikiHighlighter().then(setHighlighter);
  }, [highlighter]);

  // Compute comment anchor lines and active lines (based on real content)
  const anchorLines = useMemo(() => {
    const lines = new Set<number>();
    if (!commentAnchors?.length || !content) return lines;
    for (const anchor of commentAnchors) {
      for (const line of findLinesForText(content, anchor)) {
        lines.add(line);
      }
    }
    return lines;
  }, [commentAnchors, content]);

  const activeLines = useMemo(() => {
    if (!activeAnchorText || !content) return new Set<number>();
    return findLinesForText(content, activeAnchorText);
  }, [activeAnchorText, content]);

  // Inline check preview: inject suggestion text into displayed content (like tiptap does)
  const checkPreview = useMemo(() => {
    if (!activeCheck?.text || !activeCheck?.suggestion || !content) return null;

    const matchIdx = content.indexOf(activeCheck.text);
    if (matchIdx === -1) return null;

    const matchEnd = matchIdx + activeCheck.text.length;

    // Find full-line boundaries around the match
    const lineStart = content.lastIndexOf('\n', matchIdx - 1) + 1;
    let lineEnd = content.indexOf('\n', matchEnd);
    if (lineEnd === -1) lineEnd = content.length;

    // Full lines containing the match
    const matchedFullLines = content.slice(lineStart, lineEnd);
    // Same lines with the suggestion applied
    const replacementLines = matchedFullLines.replace(activeCheck.text, activeCheck.suggestion);

    // Build display content: original up to end of match lines, then replacement, then rest
    const displayContent =
      content.slice(0, lineEnd) + '\n' + replacementLines + content.slice(lineEnd);

    // Compute line indices
    let firstOrigLine = 0;
    for (let i = 0; i < lineStart; i++) {
      if (content[i] === '\n') firstOrigLine++;
    }

    const origLineCount = matchedFullLines.split('\n').length;
    const suggLineCount = replacementLines.split('\n').length;
    const suggStartLine = firstOrigLine + origLineCount;

    const originalLines = new Set<number>();
    for (let i = firstOrigLine; i < firstOrigLine + origLineCount; i++) {
      originalLines.add(i);
    }

    const suggestionLines = new Set<number>();
    for (let i = suggStartLine; i < suggStartLine + suggLineCount; i++) {
      suggestionLines.add(i);
    }

    // Map display line → real content line (null for suggestion lines)
    const displayLineCount = displayContent.split('\n').length;
    const realLineNumbers: (number | null)[] = [];
    for (let i = 0; i < displayLineCount; i++) {
      if (suggestionLines.has(i)) {
        realLineNumbers.push(null);
      } else if (i >= suggStartLine + suggLineCount) {
        realLineNumbers.push(i - suggLineCount);
      } else {
        realLineNumbers.push(i);
      }
    }

    return {
      displayContent,
      originalLines,
      suggestionLines,
      realLineNumbers,
      displayLineCount,
      firstOrigLine,
      buttonsAfterLine: suggStartLine + suggLineCount - 1,
    };
  }, [activeCheck, content]);

  // Effective content for display (with suggestion injected when check is active)
  const effectiveContent = checkPreview?.displayContent ?? content;

  const highlightedHtml = useMemo(() => {
    if (!highlighter || !effectiveContent) return null;
    const lang = getLanguageForFile(filename);
    return highlightCode(highlighter, effectiveContent, lang, codeTheme as CodeThemeKey);
  }, [highlighter, effectiveContent, filename, codeTheme]);

  const lineCount = effectiveContent ? effectiveContent.split('\n').length : 1;

  // Auto-scroll to active comment line (centered)
  useEffect(() => {
    if (!activeAnchorText || activeLines.size === 0) return;
    requestAnimationFrame(() => {
      const firstLine = Math.min(...activeLines);
      const ta = textareaRef.current;
      if (ta) {
        const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 22;
        const targetScroll = firstLine * lineHeight - ta.clientHeight / 2;
        ta.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    });
  }, [activeAnchorText, activeLines]);

  // Auto-scroll to active check line (centered)
  useEffect(() => {
    if (!activeCheck || !checkPreview) return;
    requestAnimationFrame(() => {
      const firstLine = checkPreview.firstOrigLine;
      const ta = textareaRef.current;
      if (ta) {
        const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 22;
        const targetScroll = firstLine * lineHeight - ta.clientHeight / 2;
        ta.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    });
  }, [activeCheck, checkPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const cancelPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const dismissGhost = useCallback(() => {
    setGhostText(null);
    setGhostCursorPos(0);
  }, []);

  const fetchGhostCompletion = useCallback(
    async (text: string, cursorPos: number, reqId: number) => {
      const before = text.slice(Math.max(0, cursorPos - 500), cursorPos);
      const after = text.slice(cursorPos, cursorPos + 400);

      if (before.trim().length < 10) return;

      // Detect current indentation level for scope-based truncation
      const currentLine = before.split('\n').pop() || '';
      const currentIndent = currentLine.search(/\S/);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const settings = useSettingsStore.getState();
        const res = await fetch('/api/ai/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            before,
            after,
            provider: settings.aiProvider,
            modelId: settings.aiModel,
            filename,
            userApiKey: settings.aiProvider === 'anthropic' ? settings.userAnthropicKey || undefined : settings.userOpenAIKey || undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (reqId !== requestIdRef.current) {
            reader.cancel();
            return;
          }

          accumulated += decoder.decode(value, { stream: true });

          // Run full post-processing pipeline
          const processed = processCompletion(accumulated, before, after, {
            isCode: true,
            currentIndent: currentIndent >= 0 ? currentIndent : 0,
          });
          if (processed === null) continue;

          // Ensure proper spacing
          let displayText = processed;
          const charBefore = cursorPos > 0 ? text[cursorPos - 1] : '';
          if (charBefore && !/\s/.test(charBefore) && !/^\s/.test(displayText)) {
            displayText = ' ' + displayText;
          }

          setGhostText(displayText);
          setGhostCursorPos(cursorPos);
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    },
    [filename]
  );

  const scheduleFetch = useCallback(
    (text: string, cursorPos: number) => {
      cancelPending();
      requestIdRef.current++;
      const reqId = requestIdRef.current;
      debounceRef.current = setTimeout(() => {
        fetchGhostCompletion(text, cursorPos, reqId);
      }, 400);
    },
    [cancelPending, fetchGhostCompletion]
  );

  // Position the ghost text element at the cursor line/column
  const updateGhostPosition = useCallback(() => {
    const ghost = ghostRef.current;
    const ta = textareaRef.current;
    if (!ghost || !ta) return;
    const beforeCursor = content.slice(0, ghostCursorPos);
    const lines = beforeCursor.split('\n');
    const line = lines.length - 1;
    const col = lines[lines.length - 1].length;
    // Position relative to .code-viewer-editor, accounting for scroll
    ghost.style.top = `calc(1rem + ${line} * 1lh - ${ta.scrollTop}px)`;
    ghost.style.left = `calc(1.5rem + ${col}ch - ${ta.scrollLeft}px)`;
  }, [content, ghostCursorPos]);

  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    const pre = preRef.current;
    const overlay = overlayRef.current;
    if (ta) {
      if (pre) {
        pre.scrollTop = ta.scrollTop;
        pre.scrollLeft = ta.scrollLeft;
      }
      if (overlay) {
        overlay.style.transform = `translateY(-${ta.scrollTop}px)`;
      }
      // Reposition ghost text on scroll
      updateGhostPosition();
    }
  }, [updateGhostPosition]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const newCursorPos = e.target.selectionStart;
      onChange?.(newValue);

      // Skip ghost text logic if read-only or disabled
      if (!onChange || !tabCompletionsEnabled) return;

      // Progressive matching: check if typed char matches ghost suggestion start
      if (ghostText && newCursorPos === ghostCursorPos + 1) {
        const typedChar = newValue[ghostCursorPos];
        if (typedChar && ghostText.startsWith(typedChar)) {
          const remaining = ghostText.slice(typedChar.length);
          if (remaining.length > 0) {
            setGhostText(remaining);
            setGhostCursorPos(newCursorPos);
            cancelPending();
            return;
          }
          // Entire suggestion consumed
          dismissGhost();
          cancelPending();
          return;
        }
      }

      // No progressive match — dismiss and schedule new fetch
      dismissGhost();
      scheduleFetch(newValue, newCursorPos);
    },
    [onChange, tabCompletionsEnabled, ghostText, ghostCursorPos, cancelPending, dismissGhost, scheduleFetch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ghost text: Tab accepts, Escape dismisses
      if (onChange && tabCompletionsEnabled && ghostText) {
        if (e.key === 'Tab') {
          e.preventDefault();
          const ta = e.currentTarget;
          const val = ta.value;
          const newVal = val.substring(0, ghostCursorPos) + ghostText + val.substring(ghostCursorPos);
          const newCursorPos = ghostCursorPos + ghostText.length;
          onChange(newVal);
          dismissGhost();
          cancelPending();
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = newCursorPos;
          });
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          dismissGhost();
          cancelPending();
          return;
        }

        // Arrow keys / non-printable keys dismiss ghost
        if (e.key.length > 1 && e.key !== 'Shift') {
          dismissGhost();
          cancelPending();
          return;
        }
      }

      // Tab inserts 2 spaces when no ghost text
      if (e.key === 'Tab' && !ghostText) {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = ta.value;
        const newVal = val.substring(0, start) + '  ' + val.substring(end);
        onChange?.(newVal);
        // Restore cursor position after React re-renders
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [onChange, tabCompletionsEnabled, ghostText, ghostCursorPos, dismissGhost, cancelPending]
  );

  // Dismiss ghost on click (cursor position change)
  const handleClick = useCallback(() => {
    if (ghostText) {
      dismissGhost();
      cancelPending();
    }
  }, [ghostText, dismissGhost, cancelPending]);

  // Handle clicking a comment highlight line
  const handleOverlayLineClick = useCallback(
    (lineIdx: number) => {
      if (!onHighlightClick || !commentAnchors?.length || !content) return;
      // Find which anchor text is on this line
      for (const anchor of commentAnchors) {
        const lines = findLinesForText(content, anchor);
        if (lines.has(lineIdx)) {
          const idx = content.indexOf(anchor);
          onHighlightClick({ text: anchor, from: idx, to: idx + anchor.length });
          return;
        }
      }
    },
    [onHighlightClick, commentAnchors, content]
  );

  const handleCheckKeep = useCallback(() => {
    if (!activeCheck) return;
    setCheckActionResult({ index: activeCheck.index, action: 'keep' });
    setActiveCheck(null);
  }, [activeCheck, setCheckActionResult, setActiveCheck]);

  const handleCheckDismiss = useCallback(() => {
    if (!activeCheck) return;
    setCheckActionResult({ index: activeCheck.index, action: 'dismiss' });
    setActiveCheck(null);
  }, [activeCheck, setCheckActionResult, setActiveCheck]);

  if (!content && !onChange) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Empty file
      </div>
    );
  }

  // Only show ghost text in editable mode with feature enabled (not during check preview)
  const showGhost = !!(onChange && tabCompletionsEnabled && ghostText && !checkPreview);
  const hasOverlay = anchorLines.size > 0 || activeLines.size > 0 || !!checkPreview;

  // Position ghost element when it mounts or changes
  useEffect(() => {
    if (showGhost) updateGhostPosition();
  }, [showGhost, ghostText, updateGhostPosition]);

  // Sync overlay scroll position on mount (textarea may already be scrolled, e.g. deep-linked comment)
  useEffect(() => {
    if (!hasOverlay) return;
    const ta = textareaRef.current;
    const overlay = overlayRef.current;
    if (ta && overlay) {
      overlay.style.transform = `translateY(-${ta.scrollTop}px)`;
    }
  }, [hasOverlay, activeAnchorText, activeCheck]);

  return (
    <div className="code-viewer">
      <div className="code-viewer-lines" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => {
          const isOrig = checkPreview?.originalLines.has(i) ?? false;
          const isSugg = checkPreview?.suggestionLines.has(i) ?? false;
          const realLine = checkPreview ? checkPreview.realLineNumbers[i] : i;
          const realI = realLine ?? i;
          const isActive = !isSugg && activeLines.has(realI);
          const isComment = !isSugg && anchorLines.has(realI);
          let className = 'code-viewer-line-number';
          if (isActive) className += ' has-comment-active';
          else if (isComment) className += ' has-comment';
          if (isOrig) className += ' has-check';
          if (isSugg) className += ' has-suggestion';
          return (
            <div key={i} className={className}>
              {isSugg ? '' : (realLine !== null ? realLine + 1 : i + 1)}
            </div>
          );
        })}
      </div>
      <div className="code-viewer-editor">
        {/* Syntax-highlighted layer (behind textarea) */}
        <pre ref={preRef} className="code-viewer-highlight" aria-hidden="true">
          {highlightedHtml ? (
            <code dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }} />
          ) : (
            <code>
              {effectiveContent}
              {'\n'}
            </code>
          )}
        </pre>
        {/* Comment & check highlight overlay */}
        {hasOverlay && (
          <div ref={overlayRef} className="code-viewer-comment-overlay" aria-hidden="true">
            {Array.from({ length: lineCount }, (_, i) => {
              const isOrig = checkPreview?.originalLines.has(i) ?? false;
              const isSugg = checkPreview?.suggestionLines.has(i) ?? false;
              const realLine = checkPreview ? checkPreview.realLineNumbers[i] : i;
              const isActive = realLine !== null && activeLines.has(realLine);
              const isComment = realLine !== null && anchorLines.has(realLine) && !isActive;
              if (!isActive && !isComment && !isOrig && !isSugg) {
                return <div key={i} style={{ height: 'calc(1em * var(--code-line-height))' }} />;
              }
              let className = '';
              if (isOrig) className = 'code-viewer-check-line';
              else if (isSugg) className = 'code-viewer-suggestion-line';
              else if (isActive) className = 'code-viewer-comment-line-active';
              else if (isComment) className = 'code-viewer-comment-line-default';
              return (
                <div
                  key={i}
                  className={className}
                  style={{ height: 'calc(1em * var(--code-line-height))' }}
                  onClick={isActive || isComment ? () => handleOverlayLineClick(realLine!) : undefined}
                />
              );
            })}
            {/* Inline Keep/Dismiss buttons below the suggestion lines */}
            {activeCheck && checkPreview && (
              <div
                className="absolute right-4 flex items-center gap-1 pointer-events-auto z-10"
                style={{ top: `calc(${checkPreview.buttonsAfterLine + 1} * 1em * var(--code-line-height))` }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2 bg-background/90 border shadow-sm"
                  onClick={handleCheckDismiss}
                >
                  <X className="h-3 w-3 mr-1" />
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  className="h-6 text-[11px] px-2 shadow-sm"
                  onClick={handleCheckKeep}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Keep
                </Button>
              </div>
            )}
          </div>
        )}
        {/* Editable textarea layer (transparent text, visible caret) */}
        {onChange ? (
          <textarea
            ref={textareaRef}
            className="code-viewer-textarea"
            value={effectiveContent}
            onChange={handleChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onClick={handleClick}
            readOnly={!!checkPreview}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        ) : (
          <pre className="code-viewer-readonly">
            <code>{effectiveContent}</code>
          </pre>
        )}
        {/* Ghost text — absolutely positioned at cursor line/column */}
        {showGhost && (
          <div ref={ghostRef} className="code-viewer-ghost" aria-hidden="true">
            <span className="ghost-text">{ghostText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
