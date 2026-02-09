'use client';

import { useState, useEffect } from 'react';
import { type Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  Undo,
  Redo,
  Link as LinkIcon,
  Table,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  ChevronDown,
  Pilcrow,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFileStore } from '@/stores/file-store';
import { ExportDropdown } from '@/components/editor/export-dropdown';

interface ToolbarProps {
  editor: Editor;
}

function ToolbarButton({
  onClick,
  isActive,
  icon: Icon,
  tooltip,
  disabled,
  testId,
}: {
  onClick: () => void;
  isActive?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle
            size="sm"
            pressed={isActive}
            onPressedChange={onClick}
            disabled={disabled}
            className="h-7 w-7 p-0 shrink-0"
            data-testid={testId}
            aria-label={tooltip}
            aria-pressed={isActive}
          >
            <Icon className="h-3.5 w-3.5" />
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MobileToolbarButton({
  onClick,
  isActive,
  icon: Icon,
  disabled,
  testId,
  label,
}: {
  onClick: () => void;
  isActive?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  testId?: string;
  label?: string;
}) {
  return (
    <Toggle
      size="sm"
      pressed={isActive}
      onPressedChange={onClick}
      disabled={disabled}
      className="h-9 w-9 p-0 shrink-0"
      data-testid={testId}
      aria-label={label}
      aria-pressed={isActive}
    >
      <Icon className="h-4 w-4" />
    </Toggle>
  );
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function getActiveBlockLabel(editor: Editor): string {
  if (editor.isActive('heading', { level: 1 })) return 'H1';
  if (editor.isActive('heading', { level: 2 })) return 'H2';
  if (editor.isActive('heading', { level: 3 })) return 'H3';
  if (editor.isActive('bulletList')) return 'List';
  if (editor.isActive('orderedList')) return 'Num';
  if (editor.isActive('taskList')) return 'Todo';
  if (editor.isActive('blockquote')) return 'Quote';
  return 'Text';
}

function BlockTypeDropdown({ editor, side = 'bottom' }: { editor: Editor; side?: 'top' | 'bottom' }) {
  const label = getActiveBlockLabel(editor);
  const isActive = label !== 'Text';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-0.5 rounded-md text-xs font-medium shrink-0 transition-colors ${
            side === 'top' ? 'h-9 px-2.5' : 'h-7 px-1.5'
          } ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`}
          data-testid="toolbar-block-type"
          aria-label={`Block type: ${label}. Click to change block type`}
        >
          {label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" className="min-w-[160px]">
        <DropdownMenuItem data-testid="toolbar-paragraph" onSelect={() => editor.chain().focus().setParagraph().run()}>
          <Pilcrow className="h-4 w-4" />
          Paragraph
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="toolbar-heading-1" onSelect={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-4 w-4" />
          Heading 1
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="toolbar-heading-2" onSelect={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
          Heading 2
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="toolbar-heading-3" onSelect={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
          Heading 3
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="toolbar-bullet-list" onSelect={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
          Bullet List
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="toolbar-ordered-list" onSelect={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
          Numbered List
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="toolbar-task-list" onSelect={() => editor.chain().focus().toggleTaskList().run()}>
          <CheckSquare className="h-4 w-4" />
          Task List
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="toolbar-blockquote" onSelect={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
          Blockquote
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AlignmentDropdown({ editor, side = 'bottom' }: { editor: Editor; side?: 'top' | 'bottom' }) {
  const AlignIcon = editor.isActive({ textAlign: 'center' })
    ? AlignCenter
    : editor.isActive({ textAlign: 'right' })
      ? AlignRight
      : AlignLeft;

  const currentAlignment = editor.isActive({ textAlign: 'center' })
    ? 'center'
    : editor.isActive({ textAlign: 'right' })
      ? 'right'
      : 'left';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center justify-center rounded-md shrink-0 hover:bg-accent hover:text-accent-foreground transition-colors ${
            side === 'top' ? 'h-9 w-9' : 'h-7 w-7'
          }`}
          data-testid="toolbar-alignment"
          aria-label={`Text alignment: ${currentAlignment}. Click to change alignment`}
        >
          <AlignIcon className={side === 'top' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" className="min-w-[140px]">
        <DropdownMenuItem data-testid="toolbar-align-left" onSelect={() => editor.chain().focus().setTextAlign('left').run()}>
          <AlignLeft className="h-4 w-4" />
          Left
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="toolbar-align-center" onSelect={() => editor.chain().focus().setTextAlign('center').run()}>
          <AlignCenter className="h-4 w-4" />
          Center
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="toolbar-align-right" onSelect={() => editor.chain().focus().setTextAlign('right').run()}>
          <AlignRight className="h-4 w-4" />
          Right
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Modifier key label: ⌘ on Mac, Ctrl elsewhere */
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

export function EditorToolbar({ editor }: ToolbarProps) {
  const isMobile = useIsMobile();
  const currentFile = useFileStore((s) => s.currentFile);
  const [wordCount, setWordCount] = useState({ words: 0, chars: 0 });
  const [selectionCount, setSelectionCount] = useState<{ words: number; chars: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const docText = editor.state.doc.textContent;
      setWordCount({ words: countWords(docText), chars: docText.length });

      const { from, to } = editor.state.selection;
      if (from !== to) {
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        setSelectionCount({ words: countWords(selectedText), chars: selectedText.length });
      } else {
        setSelectionCount(null);
      }
    };

    update();
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  const addLink = () => {
    const url = window.prompt('URL');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  // ── Mobile / Tablet: fixed bottom toolbar ──
  if (isMobile) {
    return (
      <>
        {/* Spacer so content isn't hidden behind fixed bar — rendered in flow */}
        <div className="h-0 md:hidden" />
        {/* Fixed bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" data-testid="editor-toolbar-mobile" role="toolbar" aria-label="Mobile formatting toolbar">
            <BlockTypeDropdown editor={editor} side="top" />

            <Separator orientation="vertical" className="mx-0.5 h-6 shrink-0" />

            <MobileToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} icon={Bold} testId="toolbar-bold" label="Bold" />
            <MobileToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} icon={Italic} testId="toolbar-italic" label="Italic" />
            <MobileToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} icon={Underline} testId="toolbar-underline" label="Underline" />
            <MobileToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} icon={Strikethrough} testId="toolbar-strikethrough" label="Strikethrough" />
            <MobileToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} icon={Code} testId="toolbar-code" label="Inline Code" />
            <MobileToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} icon={Highlighter} testId="toolbar-highlight" label="Highlight" />

            <Separator orientation="vertical" className="mx-0.5 h-6 shrink-0" />

            <MobileToolbarButton onClick={addLink} isActive={editor.isActive('link')} icon={LinkIcon} testId="toolbar-link" label="Insert link" />
            <MobileToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} icon={Table} testId="toolbar-table" label="Insert table" />
            <MobileToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={Minus} testId="toolbar-horizontal-rule" label="Insert horizontal rule" />

            <Separator orientation="vertical" className="mx-0.5 h-6 shrink-0" />

            <AlignmentDropdown editor={editor} side="top" />

            <Separator orientation="vertical" className="mx-0.5 h-6 shrink-0" />

            <MobileToolbarButton onClick={() => editor.chain().focus().undo().run()} icon={Undo} disabled={!editor.can().undo()} testId="toolbar-undo" label="Undo" />
            <MobileToolbarButton onClick={() => editor.chain().focus().redo().run()} icon={Redo} disabled={!editor.can().redo()} testId="toolbar-redo" label="Redo" />
          </div>
        </div>
      </>
    );
  }

  // ── Desktop: single-row sticky top toolbar ──
  return (
    <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-t-lg" data-testid="editor-toolbar" role="toolbar" aria-label="Formatting toolbar">
      <div className="flex items-center gap-0.5 px-2 py-1">
        <span className="px-1.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap shrink-0" data-testid="word-count" role="status" aria-live="polite" aria-label={selectionCount ? `${selectionCount.words} of ${wordCount.words} words selected, ${selectionCount.chars} of ${wordCount.chars} characters selected` : `${wordCount.words} words, ${wordCount.chars} characters`}>
          {selectionCount
            ? `${selectionCount.words} / ${wordCount.words} words · ${selectionCount.chars} / ${wordCount.chars} chars`
            : `${wordCount.words} words · ${wordCount.chars} chars`}
        </span>

        {selectionCount && (
          <>
            <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" />

            <BlockTypeDropdown editor={editor} />

            <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" />

            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} icon={Bold} tooltip={`Bold (${mod}+B)`} testId="toolbar-bold" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} icon={Italic} tooltip={`Italic (${mod}+I)`} testId="toolbar-italic" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} icon={Underline} tooltip={`Underline (${mod}+U)`} testId="toolbar-underline" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} icon={Strikethrough} tooltip={`Strikethrough (${mod}+Shift+S)`} testId="toolbar-strikethrough" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} icon={Code} tooltip={`Inline Code (${mod}+E)`} testId="toolbar-code" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} icon={Highlighter} tooltip={`Highlight (${mod}+Shift+H)`} testId="toolbar-highlight" />

            <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" />

            <AlignmentDropdown editor={editor} />

            <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" />

            <ToolbarButton onClick={addLink} isActive={editor.isActive('link')} icon={LinkIcon} tooltip={`Link (${mod}+K)`} testId="toolbar-link" />
            <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} icon={Table} tooltip="Insert Table" testId="toolbar-table" />
            <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={Minus} tooltip="Horizontal Rule" testId="toolbar-horizontal-rule" />
          </>
        )}

        {/* Push export + undo/redo to the right */}
        <div className="flex-1" />

        {currentFile && (
          <ExportDropdown
            content={currentFile.content ?? ''}
            filename={currentFile.name}
            isMarkdown={currentFile.isMarkdown ?? false}
            size="sm"
          />
        )}

        <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} icon={Undo} tooltip={`Undo (${mod}+Z)`} disabled={!editor.can().undo()} testId="toolbar-undo" />
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} icon={Redo} tooltip={`Redo (${mod}+Shift+Z)`} disabled={!editor.can().redo()} testId="toolbar-redo" />
      </div>
    </div>
  );
}
