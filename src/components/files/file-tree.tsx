'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFileStore } from '@/stores/file-store';
import type { FileNode } from '@/types';
import { isMarkdownFile } from '@/lib/editor/markdown-serializer';

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

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  onSelect: (node: FileNode) => void;
}

function FileTreeItem({ node, depth, onSelect }: FileTreeItemProps) {
  const { expandedDirs, toggleDir, currentFile } = useFileStore();
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = currentFile?.path === node.path;
  const isDir = node.type === 'directory';

  return (
    <div>
      <button
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent/50 ${
          isSelected ? 'bg-accent text-accent-foreground' : ''
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isDir) {
            toggleDir(node.path);
          } else {
            onSelect(node);
          }
        }}
      >
        {isDir ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-yellow-500" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-yellow-500" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <File className={`h-4 w-4 shrink-0 ${getFileColor(node.name)}`} />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && isExpanded && node.children?.map((child) => (
        <FileTreeItem key={child.path} node={child} depth={depth + 1} onSelect={onSelect} />
      ))}
    </div>
  );
}

interface FileTreeProps {
  onFileSelect: (node: FileNode) => void;
}

export function FileTree({ onFileSelect }: FileTreeProps) {
  const { files, showAllFiles, setShowAllFiles, searchQuery, setSearchQuery } = useFileStore();

  const filteredFiles = useMemo(() => {
    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes
        .map((node) => {
          if (node.type === 'directory') {
            const children = filterNodes(node.children || []);
            if (children.length === 0) return null;
            return { ...node, children };
          }
          if (!showAllFiles && !node.isMarkdown) return null;
          if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) return null;
          return node;
        })
        .filter(Boolean) as FileNode[];
    };
    return filterNodes(files);
  }, [files, showAllFiles, searchQuery]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={!showAllFiles}
                  onPressedChange={(pressed) => setShowAllFiles(!pressed)}
                  className="h-6 px-1.5 text-[10px] font-mono font-bold"
                >
                  <span className={showAllFiles ? 'text-muted-foreground' : 'text-primary'}>.md</span>
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{showAllFiles ? 'All files — click to filter .md only' : 'Markdown files only — click to show all'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1">
          {filteredFiles.map((node) => (
            <FileTreeItem key={node.path} node={node} depth={0} onSelect={onFileSelect} />
          ))}
          {filteredFiles.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">No files found</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
