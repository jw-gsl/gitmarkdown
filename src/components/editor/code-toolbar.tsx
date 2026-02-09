'use client';

import { useMemo } from 'react';
import { Undo, Redo } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExportDropdown } from '@/components/editor/export-dropdown';

/** Modifier key label: ⌘ on Mac, Ctrl elsewhere */
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

interface CodeToolbarProps {
  filename: string;
  content: string;
  language: string | null;
  lineCount: number;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function CodeToolbar({ filename, content, onUndo, onRedo }: CodeToolbarProps) {
  const stats = useMemo(() => ({
    words: countWords(content),
    chars: content.length,
  }), [content]);

  return (
    <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-t-lg" data-testid="code-toolbar" role="toolbar" aria-label="Code file toolbar">
      <div className="flex items-center gap-0.5 px-2 py-1">
        <span className="px-1.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap shrink-0" data-testid="word-count" role="status" aria-live="polite" aria-label={`${stats.words} words, ${stats.chars} characters`}>
          {stats.words} words · {stats.chars} chars
        </span>

        {/* Push export + undo/redo to the right */}
        <div className="flex-1" />

        <ExportDropdown
          content={content}
          filename={filename}
          isMarkdown={false}
          size="sm"
        />

        <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" />

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                onPressedChange={() => onUndo?.()}
                disabled={!onUndo}
                className="h-7 w-7 p-0 shrink-0"
                data-testid="toolbar-undo"
                aria-label={`Undo (${mod}+Z)`}
              >
                <Undo className="h-3.5 w-3.5" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Undo ({mod}+Z)</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                onPressedChange={() => onRedo?.()}
                disabled={!onRedo}
                className="h-7 w-7 p-0 shrink-0"
                data-testid="toolbar-redo"
                aria-label={`Redo (${mod}+Shift+Z)`}
              >
                <Redo className="h-3.5 w-3.5" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Redo ({mod}+Shift+Z)</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
