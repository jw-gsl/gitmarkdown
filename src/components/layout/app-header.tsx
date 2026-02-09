'use client';

import { useState, useEffect } from 'react';
import { LogOut, Settings, Moon, Sun, PanelLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/providers/auth-provider';
import { useAuthActions } from '@/hooks/use-auth';
import { useFileStore } from '@/stores/file-store';
import { useSyncStore } from '@/stores/sync-store';
import { useUIStore } from '@/stores/ui-store';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import type { SettingsTab } from '@/components/settings/settings-dialog';

interface AppHeaderProps {
  repoContext?: {
    owner: string;
    repo: string;
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
    filePath?: string;
  };
  breadcrumbSlot?: React.ReactNode;
  actions?: React.ReactNode;
}

export function AppHeader({ repoContext, breadcrumbSlot, actions }: AppHeaderProps) {
  const { user } = useAuth();
  const { logout } = useAuthActions();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const { dirtyFiles, currentFile } = useFileStore();
  const { currentBranch, baseBranch } = useSyncStore();
  const toggleFocusMode = useUIStore((s) => s.toggleFocusMode);
  const isCurrentFileDirty = currentFile ? dirtyFiles.has(currentFile.path) : false;

  /** Build a URL preserving the current branch param */
  const buildUrl = (path: string) => {
    const base = `/${repoContext?.owner}/${repoContext?.repo}/${path}`;
    return currentBranch && currentBranch !== baseBranch
      ? `${base}?branch=${encodeURIComponent(currentBranch)}`
      : base;
  };

  // Update browser tab title with unsaved indicator
  useEffect(() => {
    const fileName = repoContext?.filePath?.split('/').pop();
    if (fileName) {
      document.title = `${isCurrentFileDirty ? '● ' : ''}${fileName} - GitMarkdown`;
    } else if (repoContext) {
      document.title = `${repoContext.owner}/${repoContext.repo} - GitMarkdown`;
    } else {
      document.title = 'GitMarkdown';
    }
  }, [repoContext, isCurrentFileDirty]);

  return (
    <>
      <header data-testid="app-header" className="flex h-12 items-center border-b px-3 gap-2">
        {/* Left section: sidebar toggle + logo + breadcrumb */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {repoContext && (
            <Button
              variant="ghost"
              size="icon"
              data-testid="toggle-sidebar"
              aria-label="Toggle file sidebar"
              aria-expanded={repoContext.sidebarOpen}
              className="h-8 w-8 shrink-0 touch-manipulation -ml-2"
              onClick={repoContext.onToggleSidebar}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}

          {!repoContext && (
            <Link href="/dashboard" data-testid="logo-link" aria-label="Go to dashboard" className="flex items-center shrink-0">
              <span className="font-semibold text-sm">GitMarkdown</span>
            </Link>
          )}

          {repoContext && (
            <>
              {breadcrumbSlot}
              {repoContext.filePath && (() => {
                const segments = repoContext.filePath!.split('/');
                return segments.map((segment, i) => {
                  const isLast = i === segments.length - 1;
                  const partialPath = segments.slice(0, i + 1).join('/');
                  return (
                    <span key={partialPath} className="flex items-center shrink-0">
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mx-0.5" />
                      {isLast ? (
                        <span className="text-sm truncate max-w-[120px] sm:max-w-none">
                          {segment}
                        </span>
                      ) : (
                        <button
                          onClick={() => router.push(buildUrl(partialPath))}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer truncate max-w-[80px] sm:max-w-none"
                        >
                          {segment}
                        </button>
                      )}
                    </span>
                  );
                });
              })()}
            </>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right section: actions + avatar */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {actions}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" data-testid="user-menu" aria-label="User menu" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || ''} />
                  <AvatarFallback className="text-xs">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{user?.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleFocusMode}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Focus mode
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} initialTab={settingsTab} />
    </>
  );
}
