'use client';

import { useMemo } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFileStore } from '@/stores/file-store';
import type { FileNode } from '@/types';

interface BacklinksProps {
  currentFilePath: string;
  onNavigate: (path: string) => void;
}

export function Backlinks({ currentFilePath, onNavigate }: BacklinksProps) {
  const { files } = useFileStore();
  const fileName = currentFilePath.split('/').pop() || '';

  const backlinks = useMemo(() => {
    const results: { file: FileNode; matches: number }[] = [];
    const searchTerm = fileName.replace(/\.[^/.]+$/, '');

    const findInFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          if (node.children) findInFiles(node.children);
          continue;
        }
        if (node.path === currentFilePath || !node.isMarkdown) continue;
        if (node.content) {
          const regex = new RegExp(`\\[.*?\\]\\(.*?${searchTerm}.*?\\)`, 'gi');
          const matches = node.content.match(regex);
          if (matches) {
            results.push({ file: node, matches: matches.length });
          }
        }
      }
    };

    findInFiles(files);
    return results;
  }, [files, currentFilePath, fileName]);

  if (backlinks.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" />
        BACKLINKS ({backlinks.length})
      </div>
      <div className="space-y-1">
        {backlinks.map(({ file, matches }) => (
          <Button
            key={file.path}
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-start px-2 py-1.5 text-xs"
            onClick={() => onNavigate(file.path)}
          >
            <span className="truncate">{file.name}</span>
            <span className="ml-auto text-muted-foreground">{matches} ref{matches > 1 ? 's' : ''}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
