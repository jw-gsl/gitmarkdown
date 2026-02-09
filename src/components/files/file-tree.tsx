'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Search,
  ListFilter,
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  ChevronsUpDown,
  ChevronsDownUp,
  Download,
  Eye,
  Copy,
  Pencil,
  Trash2,
  Check,
  Loader2,
  Plus,
  FilePlus,
  FolderPlus,
  Upload,
  ExternalLink,
  ClipboardCopy,
} from 'lucide-react';
import JSZip from 'jszip';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useFileStore } from '@/stores/file-store';
import { useSyncStore } from '@/stores/sync-store';
import { useAuth } from '@/providers/auth-provider';
import { useGitHubRepos } from '@/hooks/use-github';
import { CreateRepoDialog } from '@/components/github/create-repo-dialog';
import type { FileNode, GitHubRepo } from '@/types';

import { toast } from 'sonner';

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

type SortBy = 'alphabetical' | 'updated' | 'created';
type SortDir = 'asc' | 'desc';

const SORT_LABELS: Record<SortBy, string> = {
  alphabetical: 'Alphabetical',
  updated: 'Updated',
  created: 'Created',
};

const SORT_DIR_LABELS: Record<SortBy, Record<SortDir, string>> = {
  alphabetical: { asc: 'A-Z', desc: 'Z-A' },
  updated: { asc: 'Oldest', desc: 'Newest' },
  created: { asc: 'Oldest', desc: 'Newest' },
};

const NEXT_SORT: Record<SortBy, SortBy> = {
  alphabetical: 'updated',
  updated: 'created',
  created: 'alphabetical',
};

/** Collect all file paths from the tree for validation */
function collectAllPaths(nodes: FileNode[]): Set<string> {
  const paths = new Set<string>();
  for (const n of nodes) {
    paths.add(n.path);
    if (n.children) {
      for (const p of collectAllPaths(n.children)) paths.add(p);
    }
  }
  return paths;
}

const INVALID_FILENAME_CHARS = /[\\:*?"<>|]/;

/** Flatten the visible tree (respecting expanded state) into an ordered list */
function flattenVisibleNodes(nodes: FileNode[], expandedDirs: Set<string>): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.type === 'directory' && expandedDirs.has(node.path) && node.children) {
      result.push(...flattenVisibleNodes(node.children, expandedDirs));
    }
  }
  return result;
}

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  onSelect: (node: FileNode) => void;
  onDuplicate?: (node: FileNode) => void;
  onRename?: (node: FileNode, newName: string) => void;
  onDelete?: (node: FileNode) => void;
  onMoveFile?: (node: FileNode, targetDir: string) => void;
  busyPaths?: Set<string>;
  focusedPath?: string | null;
}

function FileTreeItem({ node, depth, onSelect, onDuplicate, onRename, onDelete, onMoveFile, busyPaths, focusedPath }: FileTreeItemProps) {
  const { expandedDirs, toggleDir, currentFile } = useFileStore();
  const pendingOps = useFileStore((s) => s.pendingOps);
  const isDirty = useFileStore((s) => s.dirtyFiles.has(node.path));
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = currentFile?.path === node.path;
  const isFocused = focusedPath === node.path;
  const isDir = node.type === 'directory';
  const isMd = node.isMarkdown;
  const isBusy = busyPaths?.has(node.path) ?? false;

  const pendingStatus = useMemo(() => {
    for (const op of pendingOps) {
      if (op.type === 'delete' && op.path === node.path) return 'deleted';
      if (op.type === 'create' && op.path === node.path) return 'created';
      if (op.type === 'duplicate' && op.newPath === node.path) return 'created';
      if (op.type === 'rename' && op.newPath === node.path) return 'renamed';
      if (op.type === 'move' && op.newPath === node.path) return 'moved';
    }
    return null;
  }, [pendingOps, node.path]);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteCtx, setConfirmDeleteCtx] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll selected file into view on mount
  useEffect(() => {
    if (isSelected && buttonRef.current) {
      buttonRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus({ preventScroll: true });
      // Select just the filename part (without extension)
      const dotIdx = renameValue.lastIndexOf('.');
      renameInputRef.current?.setSelectionRange(0, dotIdx > 0 ? dotIdx : renameValue.length);
    }
  }, [isRenaming]);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed.includes('/')) {
      setRenameValue(node.name);
      setIsRenaming(false);
      return;
    }
    // Validate invalid characters
    if (INVALID_FILENAME_CHARS.test(trimmed)) {
      toast.error('Filename contains invalid characters');
      return;
    }
    // Validate length (GitHub max path is 255)
    if (trimmed.length > 255) {
      toast.error('Filename is too long');
      return;
    }
    // Ensure .md extension is preserved for markdown files
    const finalName = isMd && !trimmed.endsWith('.md') ? trimmed + '.md' : trimmed;
    if (finalName === node.name) {
      setIsRenaming(false);
      return;
    }
    // Check if target name already exists in the same directory
    const dir = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/') + 1) : '';
    const targetPath = `${dir}${finalName}`;
    const existingPaths = collectAllPaths(useFileStore.getState().files);
    if (existingPaths.has(targetPath)) {
      toast.error(`A file named "${finalName}" already exists`);
      return;
    }
    onRename?.(node, finalName);
    setIsRenaming(false);
  }, [renameValue, node, isMd, onRename]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitRename();
      } else if (e.key === 'Escape') {
        setRenameValue(node.name);
        setIsRenaming(false);
      }
    },
    [commitRename, node.name]
  );

  const params = useParams();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const { currentBranch } = useSyncStore();

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(node.path);
    toast.success('Path copied');
  }, [node.path]);

  const handleOpenOnGitHub = useCallback(() => {
    const branch = currentBranch || 'main';
    const type = isDir ? 'tree' : 'blob';
    window.open(`https://github.com/${owner}/${repo}/${type}/${branch}/${node.path}`, '_blank');
  }, [owner, repo, currentBranch, node.path, isDir]);

  // Drag-to-move state
  const [isDragOverDir, setIsDragOverDir] = useState(false);

  const handleDragStartItem = useCallback((e: React.DragEvent) => {
    if (isDir || isBusy) { e.preventDefault(); return; }
    e.dataTransfer.setData('text/x-file-path', node.path);
    e.dataTransfer.effectAllowed = 'move';
  }, [node.path, isDir, isBusy]);

  const handleDragOverDir = useCallback((e: React.DragEvent) => {
    if (!isDir) return;
    if (e.dataTransfer.types.includes('text/x-file-path')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOverDir(true);
    }
  }, [isDir]);

  const handleDragLeaveDir = useCallback(() => {
    setIsDragOverDir(false);
  }, []);

  const handleDropOnDir = useCallback((e: React.DragEvent) => {
    if (!isDir) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverDir(false);
    const sourcePath = e.dataTransfer.getData('text/x-file-path');
    if (!sourcePath) return;
    // Don't allow dropping into own parent (no-op)
    const sourceDir = sourcePath.includes('/') ? sourcePath.substring(0, sourcePath.lastIndexOf('/')) : '';
    if (sourceDir === node.path) return;
    // Find the source node from the store
    const findNode = (nodes: FileNode[], path: string): FileNode | null => {
      for (const n of nodes) {
        if (n.path === path) return n;
        if (n.children) {
          const found = findNode(n.children, path);
          if (found) return found;
        }
      }
      return null;
    };
    const sourceNode = findNode(useFileStore.getState().files, sourcePath);
    if (sourceNode) {
      onMoveFile?.(sourceNode, node.path);
    }
  }, [isDir, node.path, onMoveFile]);

  return (
    <div>
      <ContextMenu onOpenChange={(open) => { if (!open) setConfirmDeleteCtx(false); }}>
        <ContextMenuTrigger asChild>
      <div className="group relative flex items-center">
        <button
          ref={buttonRef}
          data-path={node.path}
          data-testid={`file-item-${node.path}`}
          aria-label={isDir ? `Open folder: ${node.name}` : `Open file: ${node.name}`}
          draggable={!isDir && !isRenaming && !isBusy}
          onDragStart={handleDragStartItem}
          onDragOver={handleDragOverDir}
          onDragLeave={handleDragLeaveDir}
          onDrop={handleDropOnDir}
          className={`flex w-full items-center gap-1.5 overflow-hidden rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent/50 ${
            isSelected ? 'bg-accent text-accent-foreground' : ''
          } ${isFocused && !isSelected ? 'ring-1 ring-ring bg-accent/30' : ''} ${isBusy ? 'opacity-60 pointer-events-none' : ''} ${isDragOverDir ? 'bg-primary/10 ring-1 ring-primary/40' : ''} ${pendingStatus === 'deleted' ? 'line-through opacity-50' : ''}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (isRenaming || isBusy) return;
            if (pendingStatus === 'deleted') return;
            if (isDir) {
              toggleDir(node.path);
              return;
            }
            // Delay single-click to allow double-click detection
            if (clickTimer.current) {
              clearTimeout(clickTimer.current);
              clickTimer.current = null;
              // Double-click: trigger rename for .md files
              if (isMd) {
                setRenameValue(node.name);
                setIsRenaming(true);
              }
            } else {
              clickTimer.current = setTimeout(() => {
                clickTimer.current = null;
                onSelect(node);
              }, 250);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'F2' && isMd && !isRenaming && !isBusy) {
              e.preventDefault();
              setRenameValue(node.name);
              setIsRenaming(true);
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
          {isRenaming ? (
            <input
              ref={renameInputRef}
              data-testid="rename-input"
              aria-label="New file name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border border-input bg-background px-1 py-0 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <>
              <span className="truncate" title={node.path}>{node.name}</span>
              {pendingStatus && (
                <span className={`ml-1 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                  pendingStatus === 'created' ? 'bg-green-500' :
                  pendingStatus === 'deleted' ? 'bg-red-500' :
                  'bg-blue-500'
                }`} title={pendingStatus} />
              )}
              {!pendingStatus && isDirty && (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full shrink-0 bg-yellow-500" title="modified" />
              )}
            </>
          )}
        </button>
        {/* Spinner when busy */}
        {isBusy && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5" role="status" aria-busy="true" aria-label="Processing file operation">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          </div>
        )}
        {/* Context menu for markdown files */}
        {isMd && !isRenaming && !isBusy && (
          <DropdownMenu open={menuOpen} onOpenChange={(open) => { setMenuOpen(open); if (!open) setConfirmDelete(false); }}>
            <DropdownMenuTrigger asChild>
              <button
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 data-[state=open]:opacity-100"
                onClick={(e) => e.stopPropagation()}
                data-testid={`file-actions-${node.path}`}
                aria-label={`More actions for ${node.name}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                data-testid="context-duplicate"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate?.(node);
                }}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                <span className="text-xs">Duplicate</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="context-rename"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameValue(node.name);
                  setIsRenaming(true);
                }}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                <span className="text-xs">Rename</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="context-delete"
                onSelect={(e) => {
                  if (!confirmDelete) {
                    e.preventDefault();
                    setConfirmDelete(true);
                  } else {
                    onDelete?.(node);
                  }
                }}
              >
                {confirmDelete ? (
                  <>
                    <Check className="mr-2 h-3.5 w-3.5" />
                    <span className="text-xs">Click to confirm</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    <span className="text-xs">Delete</span>
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          {isMd && (
            <>
              <ContextMenuItem onClick={() => onDuplicate?.(node)}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Duplicate
              </ContextMenuItem>
              <ContextMenuItem onClick={() => { setRenameValue(node.name); setIsRenaming(true); }}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Rename
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={handleCopyPath}>
            <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
            Copy path
          </ContextMenuItem>
          <ContextMenuItem onClick={handleOpenOnGitHub}>
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            Open on GitHub
          </ContextMenuItem>
          {isMd && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="group/delete"
                onSelect={(e) => {
                  if (!confirmDeleteCtx) {
                    e.preventDefault();
                    setConfirmDeleteCtx(true);
                  } else {
                    onDelete?.(node);
                  }
                }}
              >
                {confirmDeleteCtx ? (
                  <>
                    <Check className="mr-2 h-3.5 w-3.5 !text-current" />
                    Click to confirm
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-3.5 w-3.5 transition-colors group-focus/delete:!text-red-500" />
                    Delete
                  </>
                )}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {isDir && isExpanded && node.children?.map((child) => (
        <FileTreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          onSelect={onSelect}
          onDuplicate={onDuplicate}
          onRename={onRename}
          onDelete={onDelete}
          onMoveFile={onMoveFile}
          busyPaths={busyPaths}
          focusedPath={focusedPath}
        />
      ))}
    </div>
  );
}

function sortNodes(nodes: FileNode[], sortBy: SortBy, sortDir: SortDir): FileNode[] {
  const sorted = [...nodes].sort((a, b) => {
    // Directories always come first
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;

    // For 'updated' and 'created', we don't have real timestamps from the tree,
    // so fall back to alphabetical ordering with the requested direction.
    const cmp = a.name.localeCompare(b.name);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return sorted.map((node) => {
    if (node.type === 'directory' && node.children) {
      return { ...node, children: sortNodes(node.children, sortBy, sortDir) };
    }
    return node;
  });
}

/** Collect all markdown file paths from the tree */
function collectMarkdownFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === 'directory' && node.children) {
      result.push(...collectMarkdownFiles(node.children));
    } else if (node.isMarkdown) {
      result.push(node);
    }
  }
  return result;
}

interface FileTreeProps {
  owner: string;
  repo: string;
  onFileSelect: (node: FileNode) => void;
  onDuplicate?: (node: FileNode) => void;
  onRename?: (node: FileNode, newName: string) => void;
  onDelete?: (node: FileNode) => void;
  onMoveFile?: (node: FileNode, targetDir: string) => void;
  onNewFile?: (name: string) => void;
  onNewFolder?: (name: string) => void;
  onDropFiles?: (files: { name: string; content: string }[]) => void;
  busyPaths?: Set<string>;
}

export function FileTree({ owner, repo, onFileSelect, onDuplicate, onRename, onDelete, onMoveFile, onNewFile, onNewFolder, onDropFiles, busyPaths }: FileTreeProps) {
  const { files, showAllFiles, setShowAllFiles, searchQuery, setSearchQuery, expandAllDirs, collapseAllDirs, expandedDirs, toggleDir, currentFile } = useFileStore();
  const { currentBranch } = useSyncStore();
  const { user } = useAuth();
  const router = useRouter();
  const { repos, fetchRepos, createRepo } = useGitHubRepos();
  const [repoPopoverOpen, setRepoPopoverOpen] = useState(false);
  const [createRepoOpen, setCreateRepoOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [repoSelectedIndex, setRepoSelectedIndex] = useState(0);
  const repoSearchInputRef = useRef<HTMLInputElement>(null);

  const [sortBy, setSortBy] = useState<SortBy>('alphabetical');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [exporting, setExporting] = useState(false);

  // Fetch repos when dropdown opens
  useEffect(() => {
    if (repoPopoverOpen && repos.length === 0) {
      fetchRepos();
    }
  }, [repoPopoverOpen, repos.length, fetchRepos]);

  const filteredRepos = useMemo(() => {
    if (!repoSearch.trim()) return repos;
    const q = repoSearch.toLowerCase();
    return repos.filter((r: GitHubRepo) => r.full_name.toLowerCase().includes(q));
  }, [repos, repoSearch]);

  // Reset repo selection index when search changes
  useEffect(() => {
    setRepoSelectedIndex(0);
  }, [repoSearch]);

  // Focus repo search input when popover opens, reset on close
  useEffect(() => {
    if (repoPopoverOpen) {
      setTimeout(() => repoSearchInputRef.current?.focus(), 0);
    } else {
      setRepoSearch('');
      setRepoSelectedIndex(0);
    }
  }, [repoPopoverOpen]);

  const handleRepoKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setRepoSelectedIndex((prev) => Math.min(prev + 1, filteredRepos.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setRepoSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredRepos[repoSelectedIndex];
      if (selected) {
        router.push(`/${selected.full_name}`);
        setRepoPopoverOpen(false);
        setRepoSearch('');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setRepoPopoverOpen(false);
    }
  }, [filteredRepos, repoSelectedIndex, router]);

  // Inline creation state
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const newItemInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (creatingType) {
      newItemInputRef.current?.focus({ preventScroll: true });
      // For new file, select everything before .md
      if (creatingType === 'file') {
        const dotIdx = newItemName.lastIndexOf('.');
        newItemInputRef.current?.setSelectionRange(0, dotIdx > 0 ? dotIdx : newItemName.length);
      } else {
        newItemInputRef.current?.select();
      }
    }
  }, [creatingType]);

  const commitNewItem = useCallback(() => {
    const trimmed = newItemName.trim();
    if (!trimmed || !creatingType) {
      setCreatingType(null);
      setNewItemName('');
      return;
    }
    if (INVALID_FILENAME_CHARS.test(trimmed) || trimmed.includes('/')) {
      toast.error('Name contains invalid characters');
      return;
    }
    if (trimmed.length > 255) {
      toast.error('Name is too long');
      return;
    }
    const existingPaths = collectAllPaths(useFileStore.getState().files);
    if (creatingType === 'file') {
      const finalName = trimmed.endsWith('.md') ? trimmed : trimmed + '.md';
      if (existingPaths.has(finalName)) {
        toast.error(`A file named "${finalName}" already exists`);
        return;
      }
      onNewFile?.(finalName);
    } else {
      const folderPath = `${trimmed}/untitled.md`;
      if (existingPaths.has(folderPath)) {
        toast.error(`"${trimmed}/untitled.md" already exists`);
        return;
      }
      onNewFolder?.(trimmed);
    }
    setCreatingType(null);
    setNewItemName('');
  }, [newItemName, creatingType, onNewFile, onNewFolder]);

  const handleNewItemKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitNewItem();
      } else if (e.key === 'Escape') {
        setCreatingType(null);
        setNewItemName('');
      }
    },
    [commitNewItem]
  );

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);

      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.endsWith('.md') || f.name.endsWith('.mdx') || f.name.endsWith('.markdown')
      );
      if (droppedFiles.length === 0) {
        toast.error('Only markdown files (.md) are supported');
        return;
      }

      const parsed: { name: string; content: string }[] = [];
      for (const f of droppedFiles) {
        const text = await f.text();
        parsed.push({ name: f.name, content: text });
      }

      onDropFiles?.(parsed);
    },
    [onDropFiles]
  );

  const toggleSortDir = useCallback(() => {
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  }, []);

  const handleExportZip = useCallback(async () => {
    if (exporting || !user) return;
    setExporting(true);
    const toastId = toast.loading('Exporting markdown files...');

    try {
      const mdFiles = collectMarkdownFiles(files);
      if (mdFiles.length === 0) {
        toast.dismiss(toastId);
        toast.info('No markdown files found to export');
        setExporting(false);
        return;
      }

      const idToken = await user.getIdToken();
      const zip = new JSZip();

      const results = await Promise.allSettled(
        mdFiles.map(async (file) => {
          if (file.content != null) return { path: file.path, content: file.content };

          const qs = new URLSearchParams({
            owner,
            repo,
            path: file.path,
            ...(currentBranch ? { ref: currentBranch } : {}),
          });
          const res = await fetch(`/api/github/contents?${qs}`, {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (!res.ok) throw new Error(`Failed to fetch ${file.path}`);
          const data = await res.json();
          const raw = data.content?.replace(/\n/g, '') ?? '';
          const content = raw
            ? new TextDecoder().decode(Uint8Array.from(atob(raw), c => c.charCodeAt(0)))
            : '';
          return { path: file.path, content };
        })
      );

      let added = 0;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          zip.file(result.value.path, result.value.content);
          added++;
        }
      }

      if (added === 0) {
        toast.dismiss(toastId);
        toast.error('Failed to fetch any files');
        setExporting(false);
        return;
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${repo}-markdown.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.dismiss(toastId);
      toast.success(`Exported ${added} markdown file${added !== 1 ? 's' : ''}`);
    } catch {
      toast.dismiss(toastId);
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, [exporting, user, files, owner, repo, currentBranch]);

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
    return sortNodes(filterNodes(files), sortBy, sortDir);
  }, [files, showAllFiles, searchQuery, sortBy, sortDir]);

  // Keyboard navigation state
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Flat list of visible nodes (respecting expanded dirs)
  const flatNodes = useMemo(
    () => flattenVisibleNodes(filteredFiles, expandedDirs),
    [filteredFiles, expandedDirs]
  );

  const handleTreeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't handle if typing in an input (search, rename, new item)
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      const key = e.key;
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'ArrowRight', 'ArrowLeft'].includes(key)) return;
      e.preventDefault();

      const currentIndex = focusedPath
        ? flatNodes.findIndex((n) => n.path === focusedPath)
        : -1;

      if (key === 'ArrowDown') {
        const nextIndex = currentIndex < flatNodes.length - 1 ? currentIndex + 1 : 0;
        const next = flatNodes[nextIndex];
        if (next) {
          setFocusedPath(next.path);
          // Scroll into view
          requestAnimationFrame(() => {
            treeContainerRef.current
              ?.querySelector(`[data-path="${CSS.escape(next.path)}"]`)
              ?.scrollIntoView({ block: 'nearest' });
          });
        }
      } else if (key === 'ArrowUp') {
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : flatNodes.length - 1;
        const prev = flatNodes[prevIndex];
        if (prev) {
          setFocusedPath(prev.path);
          requestAnimationFrame(() => {
            treeContainerRef.current
              ?.querySelector(`[data-path="${CSS.escape(prev.path)}"]`)
              ?.scrollIntoView({ block: 'nearest' });
          });
        }
      } else if (key === 'Enter') {
        const node = flatNodes[currentIndex];
        if (node) {
          if (node.type === 'directory') {
            toggleDir(node.path);
          } else {
            onFileSelect(node);
          }
        }
      } else if (key === 'ArrowRight') {
        const node = flatNodes[currentIndex];
        if (node?.type === 'directory' && !expandedDirs.has(node.path)) {
          toggleDir(node.path);
        }
      } else if (key === 'ArrowLeft') {
        const node = flatNodes[currentIndex];
        if (node?.type === 'directory' && expandedDirs.has(node.path)) {
          toggleDir(node.path);
        }
      }
    },
    [focusedPath, flatNodes, expandedDirs, toggleDir, onFileSelect]
  );

  // Sync focused path to current file when it changes externally
  useEffect(() => {
    if (currentFile?.path) {
      setFocusedPath(currentFile.path);
    }
  }, [currentFile?.path]);

  return (
    <nav
      data-testid="file-tree"
      aria-label="File explorer"
      className="flex h-full flex-col relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary/40 rounded-lg m-1 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-8 w-8" />
            <span className="text-xs font-medium">Drop markdown files here</span>
          </div>
        </div>
      )}

      <div className="space-y-1.5 border-b px-3 pb-3 overflow-hidden">
        {/* Repo selector + new file button — h-9 to align with tab bar */}
        <div className="flex h-9 items-center justify-between gap-1">
          <Popover open={repoPopoverOpen} onOpenChange={setRepoPopoverOpen}>
            <PopoverTrigger asChild>
              <button data-testid="repo-selector" aria-label={`Current repository: ${owner}/${repo}. Click to switch repositories`} className="flex items-center gap-1 text-sm font-semibold hover:text-muted-foreground transition-colors cursor-pointer min-w-0 truncate">
                <span className="truncate">{owner}/{repo}</span>
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0" sideOffset={8}>
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  ref={repoSearchInputRef}
                  data-testid="repo-search-input"
                  aria-label="Search repositories"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  onKeyDown={handleRepoKeyDown}
                  placeholder="Find a repository..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {filteredRepos.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    {repos.length === 0 ? 'Loading...' : 'No repos found'}
                  </div>
                ) : (
                  filteredRepos.map((r: GitHubRepo, index: number) => {
                    const isCurrent = r.full_name === `${owner}/${repo}`;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          router.push(`/${r.full_name}`);
                          setRepoPopoverOpen(false);
                          setRepoSearch('');
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors ${index === repoSelectedIndex ? 'bg-accent' : ''}`}
                      >
                        <span className="w-4 shrink-0">
                          {isCurrent && <Check className="h-3.5 w-3.5 text-primary" />}
                        </span>
                        <span className="truncate">{r.full_name}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {/* Create new repository */}
              <div className="border-t px-1 py-1">
                <button
                  data-testid="new-repo-button"
                  aria-label="Create new repository"
                  onClick={() => {
                    setRepoPopoverOpen(false);
                    setCreateRepoOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New repository</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid="new-file-menu" aria-label="Create new file or folder">
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem data-testid="new-file-button" onClick={() => { setCreatingType('file'); setNewItemName('untitled.md'); }}>
                <FilePlus className="mr-2 h-3.5 w-3.5" />
                <span className="text-xs">New File</span>
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="new-folder-button" onClick={() => { setCreatingType('folder'); setNewItemName('new-folder'); }}>
                <FolderPlus className="mr-2 h-3.5 w-3.5" />
                <span className="text-xs">New Folder</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="file-search-input"
            aria-label="Search files in repository"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Controls row: sort, direction, spacer, more — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-0.5 min-w-0">
          {/* Sort by toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground shrink-0"
            onClick={() => {
              const next = NEXT_SORT[sortBy];
              setSortBy(next);
              setSortDir(next === 'alphabetical' ? 'asc' : 'desc');
            }}
          >
            <ListFilter className="h-3 w-3 shrink-0" />
            {SORT_LABELS[sortBy]}
          </Button>

          {/* Direction toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground shrink-0"
            onClick={toggleSortDir}
          >
            {sortDir === 'asc' ? (
              <ArrowDown className="h-3 w-3 shrink-0" />
            ) : (
              <ArrowUp className="h-3 w-3 shrink-0" />
            )}
            {SORT_DIR_LABELS[sortBy][sortDir]}
          </Button>

          <div className="flex-1" />

          {/* More actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setShowAllFiles(!showAllFiles)}>
                <Eye className="mr-2 h-3.5 w-3.5" />
                <span className="text-xs">Show non-markdown</span>
                {showAllFiles && <Check className="ml-auto h-3.5 w-3.5" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={expandAllDirs}>
                <ChevronsUpDown className="mr-2 h-3.5 w-3.5" />
                <span className="text-xs">Expand all</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={collapseAllDirs}>
                <ChevronsDownUp className="mr-2 h-3.5 w-3.5" />
                <span className="text-xs">Collapse all</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportZip} disabled={exporting}>
                <Download className="mr-2 h-3.5 w-3.5" />
                <span className="text-xs">Export all</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1 [&>div>div]:!overflow-x-hidden">
        <div
          ref={treeContainerRef}
          className="p-1 pr-2 outline-none"
          tabIndex={0}
          onKeyDown={handleTreeKeyDown}
        >
          {/* Inline new item input */}
          {creatingType && (
            <div className="flex items-center gap-1.5 rounded-md px-2 py-1">
              <span className="w-3.5" />
              {creatingType === 'folder' ? (
                <Folder className="h-4 w-4 shrink-0 text-yellow-500" />
              ) : (
                <File className="h-4 w-4 shrink-0 text-blue-500" />
              )}
              <input
                ref={newItemInputRef}
                data-testid={creatingType === 'file' ? 'new-file-input' : 'new-folder-input'}
                aria-label={creatingType === 'file' ? 'New file name' : 'New folder name'}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onBlur={commitNewItem}
                onKeyDown={handleNewItemKeyDown}
                placeholder={creatingType === 'file' ? 'filename.md' : 'folder-name'}
                className="min-w-0 flex-1 rounded border border-input bg-background px-1 py-0 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          {filteredFiles.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              onSelect={onFileSelect}
              onDuplicate={onDuplicate}
              onRename={onRename}
              onDelete={onDelete}
              onMoveFile={onMoveFile}
              busyPaths={busyPaths}
              focusedPath={focusedPath}
            />
          ))}
          {filteredFiles.length === 0 && !creatingType && (
            <div className="p-4 text-center text-xs text-muted-foreground">No files found</div>
          )}
        </div>
      </ScrollArea>

      <CreateRepoDialog
        open={createRepoOpen}
        onOpenChange={setCreateRepoOpen}
        onCreateRepo={async (name, options) => {
          const newRepo = await createRepo(name, options);
          toast.success(`Repository "${newRepo.full_name}" created`);
          router.push(`/${newRepo.full_name}`);
          return newRepo;
        }}
      />
    </nav>
  );
}
