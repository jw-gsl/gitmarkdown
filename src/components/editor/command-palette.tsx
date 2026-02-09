'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  File as FileIcon,
  Wand2,
  MessageSquare,
  History,
  PanelLeft,
  Keyboard,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { useFileStore } from '@/stores/file-store';
import { useUIStore } from '@/stores/ui-store';
import { useSyncStore } from '@/stores/sync-store';
import type { FileNode } from '@/types';

const fileIconColors: Record<string, string> = {
  '.md': 'text-blue-500',
  '.mdx': 'text-purple-500',
  '.ts': 'text-blue-600',
  '.tsx': 'text-blue-400',
  '.js': 'text-yellow-500',
  '.jsx': 'text-yellow-400',
  '.json': 'text-green-500',
  '.css': 'text-pink-500',
  '.html': 'text-orange-500',
  '.yml': 'text-red-400',
  '.yaml': 'text-red-400',
};

function getFileColor(name: string): string {
  const ext = '.' + name.split('.').pop();
  return fileIconColors[ext] || 'text-muted-foreground';
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === 'file') result.push(node);
    if (node.children) result.push(...flattenFiles(node.children));
  }
  return result;
}

interface CommandPaletteProps {
  onOpenShortcuts?: () => void;
}

export function CommandPalette({ onOpenShortcuts }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  const owner = params.owner as string;
  const repo = params.repo as string;

  const files = useFileStore((s) => s.files);
  const toggleAISidebar = useUIStore((s) => s.toggleAISidebar);
  const toggleCommentSidebar = useUIStore((s) => s.toggleCommentSidebar);
  const toggleVersionHistory = useUIStore((s) => s.toggleVersionHistory);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const currentBranch = useSyncStore((s) => s.currentBranch);
  const baseBranch = useSyncStore((s) => s.baseBranch);

  const flatFiles = useMemo(() => flattenFiles(files), [files]);

  // Listen for Cmd+P / Ctrl+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFileSelect = (filePath: string) => {
    let url = `/${owner}/${repo}/${filePath}`;
    if (currentBranch && currentBranch !== baseBranch) {
      url += `?branch=${encodeURIComponent(currentBranch)}`;
    }
    router.push(url);
    setOpen(false);
  };

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} data-testid="command-palette">
      <CommandInput placeholder="Search files and commands..." data-testid="command-search" aria-label="Search files and commands" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Files">
          {flatFiles.map((file) => (
            <CommandItem
              key={file.path}
              value={`file:${file.path}`}
              onSelect={() => handleFileSelect(file.path)}
              data-testid={`command-file-${file.path}`}
            >
              <FileIcon className={`h-4 w-4 ${getFileColor(file.name)}`} />
              <div className="flex flex-col gap-0">
                <span>{file.name}</span>
                <span className="text-xs text-muted-foreground">{file.path}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            value="Toggle AI Sidebar"
            onSelect={() => handleAction(toggleAISidebar)}
            data-testid="command-toggle-ai-sidebar"
          >
            <Wand2 className="h-4 w-4" />
            <span>Toggle AI Sidebar</span>
          </CommandItem>
          <CommandItem
            value="Toggle Comments"
            onSelect={() => handleAction(toggleCommentSidebar)}
            data-testid="command-toggle-comments"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Toggle Comments</span>
          </CommandItem>
          <CommandItem
            value="Toggle Version History"
            onSelect={() => handleAction(toggleVersionHistory)}
            data-testid="command-toggle-version-history"
          >
            <History className="h-4 w-4" />
            <span>Toggle Version History</span>
          </CommandItem>
          <CommandItem
            value="Toggle File Sidebar"
            onSelect={() => handleAction(toggleSidebar)}
            data-testid="command-toggle-file-sidebar"
          >
            <PanelLeft className="h-4 w-4" />
            <span>Toggle File Sidebar</span>
          </CommandItem>
          {onOpenShortcuts && (
            <CommandItem
              value="Keyboard Shortcuts"
              onSelect={() => handleAction(onOpenShortcuts)}
              data-testid="command-keyboard-shortcuts"
            >
              <Keyboard className="h-4 w-4" />
              <span>Keyboard Shortcuts</span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
