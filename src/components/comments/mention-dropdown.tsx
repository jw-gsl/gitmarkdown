'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface MentionUser {
  login: string;
  avatar_url: string;
  id: number;
}

interface MentionDropdownProps {
  /** Full list of repo collaborators */
  users: MentionUser[];
  /** The current query text after the @ symbol */
  query: string;
  /** Whether the dropdown is visible */
  visible: boolean;
  /** Position relative to the textarea */
  position: { top: number; left: number };
  /** Called when a user is selected */
  onSelect: (user: MentionUser) => void;
  /** Called to close without selecting */
  onClose: () => void;
}

export function MentionDropdown({
  users,
  query,
  visible,
  position,
  onSelect,
  onClose,
}: MentionDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = users.filter((u) =>
    u.login.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || filtered.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [visible, filtered, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      className="absolute z-50 w-56 rounded-md border bg-popover shadow-lg"
      style={{ bottom: `calc(100% + ${position.top}px)`, left: position.left }}
    >
      <div ref={listRef} className="max-h-48 overflow-y-auto py-1">
        {filtered.map((user, index) => (
          <button
            key={user.id}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(user);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="text-[10px]">
                {user.login.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{user.login}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
