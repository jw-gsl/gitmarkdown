'use client';

import { useState, useEffect, useMemo } from 'react';
import { LogOut, Settings, Moon, Sun, PanelLeft, ChevronRight, Check, Search } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/providers/auth-provider';
import { useAuthActions } from '@/hooks/use-auth';
import { useGitHubRepos } from '@/hooks/use-github';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import type { GitHubRepo } from '@/types';

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
  const [repoPopoverOpen, setRepoPopoverOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const { repos, fetchRepos } = useGitHubRepos();

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

  return (
    <>
      <header className="flex h-12 items-center border-b px-3 gap-2">
        {/* Left section: sidebar toggle + logo + breadcrumb */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {repoContext && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 touch-manipulation"
              onClick={repoContext.onToggleSidebar}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}

          <Link href="/dashboard" className="hidden sm:flex items-center shrink-0">
            <span className="font-semibold text-sm">GitMarkdown</span>
          </Link>

          {repoContext && (
            <>
              <ChevronRight className="hidden sm:block h-3.5 w-3.5 text-muted-foreground shrink-0 mx-0.5" />
              <Popover open={repoPopoverOpen} onOpenChange={setRepoPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center text-sm hover:text-muted-foreground transition-colors shrink-0 max-w-[160px] sm:max-w-none truncate">
                    {repoContext.owner}/{repoContext.repo}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-0" sideOffset={8}>
                  <div className="flex items-center gap-2 border-b px-3 py-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      placeholder="Find a repository..."
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {filteredRepos.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        {repos.length === 0 ? 'Loading...' : 'No repos found'}
                      </div>
                    ) : (
                      filteredRepos.map((r: GitHubRepo) => {
                        const isCurrent = r.full_name === `${repoContext.owner}/${repoContext.repo}`;
                        return (
                          <button
                            key={r.id}
                            onClick={() => {
                              router.push(`/${r.full_name}`);
                              setRepoPopoverOpen(false);
                              setRepoSearch('');
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
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
                </PopoverContent>
              </Popover>
              {/* Branch selector slot */}
              {breadcrumbSlot && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mx-0.5" />
                  {breadcrumbSlot}
                </>
              )}
              {repoContext.filePath && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mx-0.5" />
                  <span className="text-sm truncate max-w-[100px] sm:max-w-none">
                    {repoContext.filePath.split('/').pop()}
                  </span>
                </>
              )}
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
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
