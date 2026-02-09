'use client';

import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus, FilePlus, Pin, PinOff, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useFileStore } from '@/stores/file-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command';
import { UnsavedChangesDialog } from '@/components/github/unsaved-changes-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';
import type { FileNode } from '@/types';

type PendingClose =
  | { type: 'single'; path: string }
  | { type: 'closeOthers'; keepPath: string }
  | { type: 'closeToRight'; fromPath: string }
  | { type: 'closeAll' };

interface TabBarProps {
  owner: string;
  repo: string;
  buildRepoUrl: (path?: string) => string;
  onNewFile?: (name: string) => void;
}

/** Flatten a file tree into a list of file nodes (no directories) */
const MAX_VISIBLE_TABS = 12;

function flattenFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === 'file') result.push(node);
    if (node.children) result.push(...flattenFiles(node.children));
  }
  return result;
}

export function TabBar({ owner, repo, buildRepoUrl, onNewFile }: TabBarProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    openTabs, activeTabPath, closeTab, closeOtherTabs, closeTabsToRight,
    closeAllTabs, closeSavedTabs, setActiveTab, reorderTabs, dirtyFiles, files,
    pinTab, unpinTab,
  } = useFileStore();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [pendingClose, setPendingClose] = useState<PendingClose | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [sidebarDragOver, setSidebarDragOver] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const allFiles = useMemo(() => flattenFiles(files), [files]);

  // Split tabs into visible and overflow
  const visibleTabs = useMemo(() => openTabs.slice(0, MAX_VISIBLE_TABS), [openTabs]);
  const overflowTabs = useMemo(() => openTabs.slice(MAX_VISIBLE_TABS), [openTabs]);

  // ─── Scroll overflow detection ───
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState, openTabs.length]);

  const scrollBy = useCallback((amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  }, []);

  // Convert vertical scroll to horizontal
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current && e.deltaY !== 0) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // ─── Tab handlers ───
  const handleTabClick = useCallback((path: string) => {
    setActiveTab(path);
    router.push(buildRepoUrl(path));
  }, [setActiveTab, router, buildRepoUrl]);

  const handleCloseTabByPath = useCallback((path: string) => {
    const { openTabs: tabs, activeTabPath: active } = useFileStore.getState();
    closeTab(path);
    useUIStore.getState().clearTabPanelState(path);
    if (active === path) {
      const index = tabs.findIndex((t) => t.path === path);
      const remaining = tabs.filter((t) => t.path !== path);
      if (remaining.length === 0) {
        router.push(buildRepoUrl());
      } else {
        const nextIndex = index < remaining.length ? index : remaining.length - 1;
        router.push(buildRepoUrl(remaining[nextIndex].path));
      }
    }
  }, [closeTab, router, buildRepoUrl]);

  /** Check dirty before closing — show confirmation if dirty */
  const requestCloseTab = useCallback((path: string) => {
    const tab = openTabs.find(t => t.path === path);
    if (tab?.pinned) return;
    if (dirtyFiles.has(path)) {
      setPendingClose({ type: 'single', path });
    } else {
      handleCloseTabByPath(path);
    }
  }, [openTabs, dirtyFiles, handleCloseTabByPath]);

  /** Compute the list of dirty file paths affected by the pending close action */
  const dirtyFilesInScope = useMemo(() => {
    if (!pendingClose) return [];
    switch (pendingClose.type) {
      case 'single':
        return dirtyFiles.has(pendingClose.path) ? [pendingClose.path] : [];
      case 'closeOthers':
        return openTabs
          .filter(t => t.path !== pendingClose.keepPath && !t.pinned && dirtyFiles.has(t.path))
          .map(t => t.path);
      case 'closeToRight': {
        const idx = openTabs.findIndex(t => t.path === pendingClose.fromPath);
        return openTabs
          .filter((t, i) => i > idx && !t.pinned && dirtyFiles.has(t.path))
          .map(t => t.path);
      }
      case 'closeAll':
        return openTabs
          .filter(t => !t.pinned && dirtyFiles.has(t.path))
          .map(t => t.path);
    }
  }, [pendingClose, openTabs, dirtyFiles]);

  /** Execute the pending close action (called on confirm) */
  const handleConfirmClose = useCallback(() => {
    if (!pendingClose) return;
    switch (pendingClose.type) {
      case 'single':
        handleCloseTabByPath(pendingClose.path);
        break;
      case 'closeOthers': {
        closeOtherTabs(pendingClose.keepPath);
        router.push(buildRepoUrl(pendingClose.keepPath));
        break;
      }
      case 'closeToRight': {
        const { activeTabPath: active, openTabs: tabs } = useFileStore.getState();
        const clickedIndex = tabs.findIndex(t => t.path === pendingClose.fromPath);
        const activeIndex = tabs.findIndex(t => t.path === active);
        closeTabsToRight(pendingClose.fromPath);
        if (active && activeIndex > clickedIndex) {
          router.push(buildRepoUrl(pendingClose.fromPath));
        }
        break;
      }
      case 'closeAll': {
        const { openTabs: tabs } = useFileStore.getState();
        const pinned = tabs.filter(t => t.pinned);
        closeAllTabs();
        if (pinned.length > 0) {
          router.push(buildRepoUrl(pinned[0].path));
        } else {
          router.push(buildRepoUrl());
        }
        break;
      }
    }
    setPendingClose(null);
  }, [pendingClose, handleCloseTabByPath, closeOtherTabs, closeTabsToRight, closeAllTabs, router, buildRepoUrl]);

  const handleTabClose = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    requestCloseTab(path);
  }, [requestCloseTab]);

  const handleMiddleClick = useCallback((e: React.MouseEvent, path: string) => {
    if (e.button === 1) {
      e.preventDefault();
      requestCloseTab(path);
    }
  }, [requestCloseTab]);

  // ─── Drag-and-drop (tab reorder) ───
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-tab-index', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex) {
      reorderTabs(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, reorderTabs]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  // ─── Drag from sidebar (file tree) into tab bar ───
  const handleBarDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('text/x-file-path')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setSidebarDragOver(true);
    }
  }, []);

  const handleBarDragLeave = useCallback(() => {
    setSidebarDragOver(false);
  }, []);

  const handleBarDrop = useCallback((e: React.DragEvent) => {
    setSidebarDragOver(false);
    const filePath = e.dataTransfer.getData('text/x-file-path');
    if (filePath) {
      e.preventDefault();
      router.push(buildRepoUrl(filePath));
    }
  }, [router, buildRepoUrl]);

  // ─── Context menu actions ───
  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
    toast.success('Path copied');
  }, []);

  const handleCloseOthers = useCallback((path: string) => {
    const hasDirty = openTabs.some(t => t.path !== path && !t.pinned && dirtyFiles.has(t.path));
    if (hasDirty) {
      setPendingClose({ type: 'closeOthers', keepPath: path });
    } else {
      closeOtherTabs(path);
      router.push(buildRepoUrl(path));
    }
  }, [openTabs, dirtyFiles, closeOtherTabs, router, buildRepoUrl]);

  const handleCloseToRight = useCallback((path: string) => {
    const idx = openTabs.findIndex(t => t.path === path);
    const hasDirty = openTabs.some((t, i) => i > idx && !t.pinned && dirtyFiles.has(t.path));
    if (hasDirty) {
      setPendingClose({ type: 'closeToRight', fromPath: path });
    } else {
      const { activeTabPath: active, openTabs: tabs } = useFileStore.getState();
      const clickedIndex = tabs.findIndex((t) => t.path === path);
      const activeIndex = tabs.findIndex((t) => t.path === active);
      closeTabsToRight(path);
      if (active && activeIndex > clickedIndex) {
        router.push(buildRepoUrl(path));
      }
    }
  }, [openTabs, dirtyFiles, closeTabsToRight, router, buildRepoUrl]);

  const handleCloseAll = useCallback(() => {
    const hasDirty = openTabs.some(t => !t.pinned && dirtyFiles.has(t.path));
    if (hasDirty) {
      setPendingClose({ type: 'closeAll' });
    } else {
      const { openTabs: tabs } = useFileStore.getState();
      const pinned = tabs.filter(t => t.pinned);
      closeAllTabs();
      if (pinned.length > 0) {
        router.push(buildRepoUrl(pinned[0].path));
      } else {
        router.push(buildRepoUrl());
      }
    }
  }, [openTabs, dirtyFiles, closeAllTabs, router, buildRepoUrl]);

  const handleCloseSaved = useCallback(() => {
    closeSavedTabs();
    const { activeTabPath: newActive } = useFileStore.getState();
    if (newActive) {
      router.push(buildRepoUrl(newActive));
    } else {
      router.push(buildRepoUrl());
    }
  }, [closeSavedTabs, router, buildRepoUrl]);

  const handlePin = useCallback((path: string) => {
    pinTab(path);
  }, [pinTab]);

  const handleUnpin = useCallback((path: string) => {
    unpinTab(path);
  }, [unpinTab]);

  // ─── Plus button & file picker ───
  const handleFilePickerSelect = useCallback((file: FileNode) => {
    setPlusOpen(false);
    router.push(buildRepoUrl(file.path));
  }, [router, buildRepoUrl]);

  const handleNewFileSubmit = useCallback(() => {
    const name = newFileName.trim();
    if (!name) return;
    const finalName = name.endsWith('.md') ? name : `${name}.md`;
    onNewFile?.(finalName);
    setNewFileName('');
    setShowNewFileInput(false);
    setPlusOpen(false);
  }, [newFileName, onNewFile]);

  // ─── Double-click empty area ───
  const handleDoubleClickEmpty = useCallback(() => {
    if (onNewFile) {
      // Open plus popover in new-file mode
      setShowNewFileInput(true);
      setPlusOpen(true);
    }
  }, [onNewFile]);

  // ─── Scroll active tab into view ───
  useEffect(() => {
    if (!activeTabPath || !scrollRef.current) return;
    const el = scrollRef.current;
    const activeEl = el.querySelector(`[data-tab-path="${CSS.escape(activeTabPath)}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [activeTabPath]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      // Cmd/Ctrl + W: close active tab
      if ((e.metaKey || e.ctrlKey) && e.key === 'w' && !e.shiftKey && !e.altKey) {
        if (editable) return;
        e.preventDefault();
        const { activeTabPath: active } = useFileStore.getState();
        if (active) requestCloseTab(active);
        return;
      }

      // Alt+Shift+Right: next tab
      if (e.altKey && e.shiftKey && e.key === 'ArrowRight') {
        e.preventDefault();
        const { openTabs: tabs, activeTabPath: active } = useFileStore.getState();
        const idx = tabs.findIndex(t => t.path === active);
        if (idx >= 0 && idx < tabs.length - 1) {
          const next = tabs[idx + 1];
          setActiveTab(next.path);
          router.push(buildRepoUrl(next.path));
        }
        return;
      }

      // Alt+Shift+Left: prev tab
      if (e.altKey && e.shiftKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        const { openTabs: tabs, activeTabPath: active } = useFileStore.getState();
        const idx = tabs.findIndex(t => t.path === active);
        if (idx > 0) {
          const prev = tabs[idx - 1];
          setActiveTab(prev.path);
          router.push(buildRepoUrl(prev.path));
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [requestCloseTab, setActiveTab, router, buildRepoUrl]);

  // ─── Warn on browser close/reload with unsaved changes ───
  useEffect(() => {
    if (dirtyFiles.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyFiles.size]);

  // ─── Render ───
  const hasPinned = openTabs.some(t => t.pinned);
  const firstUnpinnedIndex = openTabs.findIndex(t => !t.pinned);

  return (
    <TooltipProvider delayDuration={500}>
      <div
        className={cn(
          'relative flex h-9 items-center border-b bg-muted/30',
          sidebarDragOver && 'ring-2 ring-inset ring-primary/40'
        )}
        onDragOver={handleBarDragOver}
        onDragLeave={handleBarDragLeave}
        onDrop={handleBarDrop}
        data-testid="tab-bar"
      >
        {/* Left scroll arrow */}
        {canScrollLeft && (
          <button
            className="absolute left-0 z-20 flex h-full w-6 items-center justify-center bg-gradient-to-r from-muted/80 to-transparent hover:from-muted"
            onClick={() => scrollBy(-200)}
            data-testid="tab-scroll-left"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Scrollable tab area */}
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="flex h-full flex-1 items-center overflow-x-auto scrollbar-none"
          role="tablist"
          aria-label="Open files"
        >
          {visibleTabs.map((tab, index) => {
            const isActive = tab.path === activeTabPath;
            const isDirty = dirtyFiles.has(tab.path);
            const isPinned = !!tab.pinned;
            const showDropIndicator = dropIndex === index && dragIndex !== null && dragIndex !== index;
            const showDivider = hasPinned && firstUnpinnedIndex === index && index > 0;

            return (
              <ContextMenu key={tab.path}>
                {/* Pinned/unpinned divider */}
                {showDivider && (
                  <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ContextMenuTrigger asChild>
                      <div
                        data-tab-path={tab.path}
                        className={cn(
                          'group relative flex h-full items-center gap-1.5 border-r px-3 cursor-pointer select-none shrink-0',
                          'transition-all duration-150',
                          isPinned ? 'min-w-[60px] max-w-[140px]' : 'min-w-[120px] max-w-[200px]',
                          isMobile && !isPinned && 'min-w-[80px]',
                          isActive
                            ? 'bg-background border-b-2 border-b-primary text-foreground'
                            : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50',
                          dragIndex === index && 'opacity-40 scale-95',
                          showDropIndicator && 'before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-primary before:rounded-full before:transition-opacity before:duration-150'
                        )}
                        onClick={() => handleTabClick(tab.path)}
                        onMouseDown={(e) => handleMiddleClick(e, tab.path)}
                        draggable={!isMobile}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        data-testid={`tab-${tab.path}`}
                        role="tab"
                        aria-selected={isActive}
                        aria-label={`${tab.name}${isPinned ? ' (pinned)' : ''}${isDirty ? ' (unsaved changes)' : ''}`}
                      >
                        {/* Pin icon for pinned tabs */}
                        {isPinned && (
                          <Pin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                        )}
                        {/* Dirty indicator */}
                        {isDirty && (
                          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 shrink-0" />
                        )}
                        {/* File name */}
                        <span className="truncate text-xs">{tab.name}</span>
                        {/* Close button (not on pinned tabs) */}
                        {!isPinned && (
                          <button
                            className={cn(
                              'ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-sm hover:bg-foreground/10 transition-opacity duration-100',
                              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            )}
                            onClick={(e) => handleTabClose(e, tab.path)}
                            onMouseDown={(e) => e.stopPropagation()}
                            data-testid={`close-tab-${tab.path}`}
                            aria-label={`Close ${tab.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </ContextMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {tab.path}
                  </TooltipContent>
                </Tooltip>
                <ContextMenuContent>
                  {isPinned ? (
                    <ContextMenuItem onClick={() => handleUnpin(tab.path)}>
                      <PinOff className="h-4 w-4 mr-2" />
                      Unpin Tab
                    </ContextMenuItem>
                  ) : (
                    <ContextMenuItem onClick={() => handlePin(tab.path)}>
                      <Pin className="h-4 w-4 mr-2" />
                      Pin Tab
                    </ContextMenuItem>
                  )}
                  <ContextMenuSeparator />
                  {!isPinned && (
                    <ContextMenuItem onClick={() => requestCloseTab(tab.path)}>
                      Close
                      <span className="ml-auto text-xs text-muted-foreground">&#8984;W</span>
                    </ContextMenuItem>
                  )}
                  <ContextMenuItem
                    onClick={() => handleCloseOthers(tab.path)}
                    disabled={openTabs.filter(t => t.path !== tab.path && !t.pinned).length === 0}
                  >
                    Close Others
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => handleCloseToRight(tab.path)}
                    disabled={openTabs.filter((t, i) => i > index && !t.pinned).length === 0}
                  >
                    Close to the Right
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleCloseAll}>
                    Close All
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleCloseSaved}>
                    Close All Saved
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => handleCopyPath(tab.path)}>
                    Copy Path
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}

          {/* Overflow "..." button when tabs exceed MAX_VISIBLE_TABS */}
          {overflowTabs.length > 0 && (
            <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      className="flex h-full items-center justify-center gap-1 px-2 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      data-testid="tab-overflow-button"
                      aria-label={`${overflowTabs.length} more tab${overflowTabs.length !== 1 ? 's' : ''}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="text-[10px] font-medium tabular-nums">{overflowTabs.length}</span>
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{overflowTabs.length} more tabs</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-64 p-1 max-h-72 overflow-y-auto" align="start">
                {overflowTabs.map((tab) => {
                  const isDirty = dirtyFiles.has(tab.path);
                  const isActive = tab.path === activeTabPath;
                  return (
                    <div
                      key={tab.path}
                      className={cn(
                        'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer transition-colors',
                        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                      )}
                      onClick={() => {
                        handleTabClick(tab.path);
                        setOverflowOpen(false);
                      }}
                    >
                      {isDirty && (
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 shrink-0" />
                      )}
                      {tab.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground/70" />}
                      <span className="truncate flex-1 text-xs">{tab.name}</span>
                      {!tab.pinned && (
                        <button
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm hover:bg-foreground/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            requestCloseTab(tab.path);
                            const remaining = overflowTabs.filter(t => t.path !== tab.path);
                            if (remaining.length === 0) setOverflowOpen(false);
                          }}
                          aria-label={`Close ${tab.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </PopoverContent>
            </Popover>
          )}

          {/* Plus button — immediately after the last tab */}
          <Popover open={plusOpen} onOpenChange={(open) => { setPlusOpen(open); if (!open) { setShowNewFileInput(false); setNewFileName(''); } }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    className="flex h-full items-center justify-center px-2 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    data-testid="new-tab-button"
                    aria-label="Open file or create new file"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Open file</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-72 p-0" align="start">
              {showNewFileInput ? (
                <div className="p-3">
                  <p className="text-xs text-muted-foreground mb-2">New file name:</p>
                  <form onSubmit={(e) => { e.preventDefault(); handleNewFileSubmit(); }}>
                    <input
                      autoFocus
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder="filename.md"
                      className="flex h-8 w-full rounded-md border bg-transparent px-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowNewFileInput(false);
                          setNewFileName('');
                        }
                      }}
                      data-testid="new-file-name-input"
                      aria-label="New file name"
                    />
                  </form>
                </div>
              ) : (
                <Command>
                  <CommandInput placeholder="Search files..." />
                  <CommandList>
                    <CommandEmpty>No files found.</CommandEmpty>
                    {onNewFile && (
                      <CommandGroup>
                        <CommandItem onSelect={() => setShowNewFileInput(true)}>
                          <FilePlus className="h-4 w-4 text-muted-foreground" />
                          <span>New File</span>
                        </CommandItem>
                      </CommandGroup>
                    )}
                    {onNewFile && <CommandSeparator />}
                    <CommandGroup heading="Files">
                      {allFiles.map((file) => (
                        <CommandItem key={file.path} value={file.path} onSelect={() => handleFilePickerSelect(file)}>
                          <span className="truncate text-sm">{file.name}</span>
                          {file.path !== file.name && (
                            <span className="ml-auto truncate text-xs text-muted-foreground max-w-[120px]">
                              {file.path.substring(0, file.path.lastIndexOf('/'))}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}
            </PopoverContent>
          </Popover>

          {/* Empty area — double-click to create new file */}
          <div
            className="flex-1 h-full min-w-[40px]"
            onDoubleClick={handleDoubleClickEmpty}
          />
        </div>

        {/* Right scroll arrow */}
        {canScrollRight && (
          <button
            className="absolute right-0 z-20 flex h-full w-6 items-center justify-center bg-gradient-to-l from-muted/80 to-transparent hover:from-muted"
            onClick={() => scrollBy(200)}
            data-testid="tab-scroll-right"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dirty tab close confirmation */}
      <UnsavedChangesDialog
        open={!!pendingClose}
        onOpenChange={(open) => { if (!open) setPendingClose(null); }}
        onDiscard={handleConfirmClose}
        dirtyFiles={dirtyFilesInScope}
        title="Unsaved changes"
        description={
          pendingClose?.type === 'single'
            ? "This file has unsaved changes that haven\u2019t been committed. Close anyway?"
            : "Some files have unsaved changes that haven\u2019t been committed. Close anyway?"
        }
        actionLabel={pendingClose?.type === 'single' ? 'Close' : 'Close all'}
      />
    </TooltipProvider>
  );
}
