'use client';

import { History, MessageSquare, SpellCheck, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { RightPanelTab } from '@/stores/ui-store';

const TABS: { id: RightPanelTab; icon: typeof History; label: string }[] = [
  { id: 'versions', icon: History, label: 'History' },
  { id: 'comments', icon: MessageSquare, label: 'Comments' },
  { id: 'checks', icon: SpellCheck, label: 'Checks' },
  { id: 'ai', icon: Wand2, label: 'AI' },
];

interface RightPanelProps {
  activeTab: RightPanelTab | null;
  onTabChange: (tab: RightPanelTab) => void;
  onClose: () => void;
  activeCommentCount?: number;
  children: React.ReactNode;
}

export function RightPanel({ activeTab, onTabChange, onClose, activeCommentCount, children }: RightPanelProps) {
  return (
    <div className="flex h-full w-80 flex-col border-l bg-background" data-testid="right-panel">
      {/* Tab bar — h-9 to align with file tab-bar */}
      <div className="flex h-9 items-center border-b px-1">
        <TooltipProvider delayDuration={300}>
          <div className="flex flex-1 items-center gap-0.5">
            {TABS.map(({ id, icon: Icon, label }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <button
                    data-testid={`right-panel-tab-${id}`}
                    aria-label={label}
                    aria-selected={activeTab === id}
                    role="tab"
                    onClick={() => onTabChange(id)}
                    className={cn(
                      'relative flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                      activeTab === id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {id === 'comments' && activeCommentCount != null && activeCommentCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-medium text-primary-foreground">
                        {activeCommentCount > 99 ? '99+' : activeCommentCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">{label}</p></TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onClose}
          aria-label="Close panel"
          data-testid="right-panel-close"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
