'use client'

import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Shortcut {
  label: string
  keys: string[]
}

interface ShortcutCategory {
  title: string
  shortcuts: Shortcut[]
}

function useIsMac() {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return true
    return /Mac|iPod|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent)
  }, [])
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">
      {children}
    </kbd>
  )
}

function ShortcutRow({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <Kbd key={i}>{key}</Kbd>
        ))}
      </div>
    </div>
  )
}

function getShortcuts(mod: string): ShortcutCategory[] {
  return [
    {
      title: 'Editing',
      shortcuts: [
        { label: 'Bold', keys: [mod, 'B'] },
        { label: 'Italic', keys: [mod, 'I'] },
        { label: 'Underline', keys: [mod, 'U'] },
        { label: 'Strikethrough', keys: [mod, 'Shift', 'S'] },
        { label: 'Inline Code', keys: [mod, 'E'] },
        { label: 'Highlight', keys: [mod, 'Shift', 'H'] },
        { label: 'Link', keys: [mod, 'K'] },
      ],
    },
    {
      title: 'Blocks',
      shortcuts: [
        { label: 'Heading 1', keys: [mod, 'Alt', '1'] },
        { label: 'Heading 2', keys: [mod, 'Alt', '2'] },
        { label: 'Heading 3', keys: [mod, 'Alt', '3'] },
        { label: 'Bullet List', keys: [mod, 'Shift', '8'] },
        { label: 'Ordered List', keys: [mod, 'Shift', '7'] },
        { label: 'Task List', keys: [mod, 'Shift', '9'] },
        { label: 'Blockquote', keys: [mod, 'Shift', 'B'] },
        { label: 'Code Block', keys: [mod, 'Alt', 'C'] },
      ],
    },
    {
      title: 'Tabs',
      shortcuts: [
        { label: 'Close Tab', keys: [mod, 'W'] },
        { label: 'Next Tab', keys: ['Alt', 'Shift', '→'] },
        { label: 'Previous Tab', keys: ['Alt', 'Shift', '←'] },
      ],
    },
    {
      title: 'General',
      shortcuts: [
        { label: 'Undo', keys: [mod, 'Z'] },
        { label: 'Redo', keys: [mod, 'Shift', 'Z'] },
        { label: 'Find', keys: [mod, 'F'] },
        { label: 'Find & Replace', keys: [mod, 'H'] },
        { label: 'AI Inline Edit', keys: [mod, 'E'] },
        { label: 'AI Chat', keys: [mod, 'J'] },
        { label: 'Add Comment', keys: [mod, 'Shift', 'M'] },
        { label: 'Focus Mode', keys: [mod, '.'] },
        { label: 'Command Palette', keys: [mod, 'P'] },
        { label: 'Keyboard Shortcuts', keys: ['?'] },
      ],
    },
  ]
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const isMac = useIsMac()
  const mod = isMac ? '\u2318' : 'Ctrl'
  const categories = useMemo(() => getShortcuts(mod), [mod])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md" data-testid="keyboard-shortcuts-dialog">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quick reference for all available shortcuts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category.title}>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {category.title}
              </h3>
              <div className="space-y-0.5">
                {category.shortcuts.map((shortcut) => (
                  <ShortcutRow
                    key={shortcut.label}
                    label={shortcut.label}
                    keys={shortcut.keys}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
