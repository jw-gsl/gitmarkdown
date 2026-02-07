'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import data from '@emoji-mart/data';
import { ChevronDown, Plus, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  useSettingsStore,
  DEFAULT_PERSONAS,
  type AIPersona,
} from '@/stores/settings-store';
import { useAuth } from '@/providers/auth-provider';
import {
  getPersonas,
  createPersona,
  deletePersona,
} from '@/lib/firebase/firestore';

const EmojiPicker = dynamic(
  () => import('@emoji-mart/react').then((mod) => mod.default),
  { ssr: false }
);

/** Shared state for Firestore-loaded personas so multiple hook consumers stay in sync */
let _firestorePersonas: AIPersona[] = [];
const _listeners: Set<() => void> = new Set();
function _notify() { _listeners.forEach((l) => l()); }

function useFirestorePersonas(userId: string | undefined) {
  const [personas, setPersonas] = useState<AIPersona[]>(_firestorePersonas);

  useEffect(() => {
    const handler = () => setPersonas([..._firestorePersonas]);
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getPersonas(userId).then((docs) => {
      if (cancelled) return;
      _firestorePersonas = docs.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        instructions: d.instructions,
        avatar: d.avatar,
      }));
      _notify();
    });
    return () => { cancelled = true; };
  }, [userId]);

  return {
    personas,
    add(p: AIPersona) {
      _firestorePersonas = [..._firestorePersonas, p];
      _notify();
    },
    remove(id: string) {
      _firestorePersonas = _firestorePersonas.filter((p) => p.id !== id);
      _notify();
    },
  };
}

export function PersonaSelector() {
  const { user } = useAuth();
  const activePersonaId = useSettingsStore((s) => s.activePersonaId);
  const setActivePersonaId = useSettingsStore((s) => s.setActivePersonaId);
  const { personas: customPersonas, add, remove } = useFirestorePersonas(user?.uid);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [newEmoji, setNewEmoji] = useState('✦');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const allPersonas: AIPersona[] = [...DEFAULT_PERSONAS, ...customPersonas];
  const active = allPersonas.find((p) => p.id === activePersonaId) ?? DEFAULT_PERSONAS[0];

  const handleSelect = useCallback(
    (persona: AIPersona) => {
      setActivePersonaId(persona.id);
      setOpen(false);
      setCreating(false);
    },
    [setActivePersonaId]
  );

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !user) return;
    const personaData = {
      name: newName.trim(),
      description: newDescription.trim() || 'Custom persona',
      instructions: newInstructions.trim(),
      avatar: newEmoji,
    };
    const id = await createPersona(user.uid, personaData);
    add({ id, ...personaData });
    setActivePersonaId(id);
    setCreating(false);
    setOpen(false);
    setNewName('');
    setNewDescription('');
    setNewInstructions('');
    setNewEmoji('✦');
  }, [newName, newDescription, newInstructions, newEmoji, user, add, setActivePersonaId]);

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user) return;
      if (confirmDeleteId === id) {
        await deletePersona(user.uid, id);
        remove(id);
        if (activePersonaId === id) setActivePersonaId('default');
        setConfirmDeleteId(null);
      } else {
        setConfirmDeleteId(id);
      }
    },
    [confirmDeleteId, user, remove, activePersonaId, setActivePersonaId]
  );

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setCreating(false); setConfirmDeleteId(null); setEmojiPickerOpen(false); } }}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          Chatting with <span className="font-medium text-foreground">{active.name}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {creating ? (
          /* ── Create persona form ── */
          <div className="p-3 space-y-3">
            <p className="text-xs font-medium">Create Persona</p>
            <div className="flex items-center gap-2">
              <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                  <button className="flex h-8 w-8 items-center justify-center rounded-md border text-sm hover:bg-accent">
                    {newEmoji}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-auto p-0 border-0">
                  <EmojiPicker
                    data={data}
                    onEmojiSelect={(emoji: { native: string }) => {
                      setNewEmoji(emoji.native);
                      setEmojiPickerOpen(false);
                    }}
                    theme="auto"
                    previewPosition="none"
                    skinTonePosition="none"
                  />
                </PopoverContent>
              </Popover>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                className="h-8 text-xs"
                autoFocus
              />
            </div>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Short description"
              className="h-8 text-xs"
            />
            <Textarea
              value={newInstructions}
              onChange={(e) => setNewInstructions(e.target.value)}
              placeholder="Custom instructions for tone, style, behavior..."
              className="min-h-[60px] text-xs resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleCreate} disabled={!newName.trim() || !user}>
                Create
              </Button>
            </div>
          </div>
        ) : (
          /* ── Persona list ── */
          <div>
            <div className="max-h-64 overflow-y-auto py-1">
              {allPersonas.map((persona) => (
                <div
                  key={persona.id}
                  className={`group flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors ${
                    persona.id === activePersonaId ? 'bg-accent/30' : ''
                  }`}
                  onClick={() => handleSelect(persona)}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm">
                    {persona.avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{persona.name}</span>
                      {persona.isDefault && (
                        <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{persona.description}</p>
                  </div>
                  {!persona.isDefault && (
                    <button
                      className={`h-5 w-5 shrink-0 flex items-center justify-center rounded-sm transition-opacity ${
                        confirmDeleteId === persona.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      } hover:bg-muted`}
                      onClick={(e) => handleDelete(persona.id, e)}
                      title={confirmDeleteId === persona.id ? 'Click to confirm' : 'Delete'}
                    >
                      {confirmDeleteId === persona.id ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
            {user && (
              <div className="border-t">
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                  onClick={() => setCreating(true)}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  Create Persona
                </button>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Get the active persona (with fallback) */
export function useActivePersona(): AIPersona {
  const { user } = useAuth();
  const activePersonaId = useSettingsStore((s) => s.activePersonaId);
  const { personas: customPersonas } = useFirestorePersonas(user?.uid);
  const all = [...DEFAULT_PERSONAS, ...customPersonas];
  return all.find((p) => p.id === activePersonaId) ?? DEFAULT_PERSONAS[0];
}
