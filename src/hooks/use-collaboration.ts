'use client';

import { useCollaboration } from '@/providers/collaboration-provider';
import type { CollaboratorPresence } from '@/types';

export function useCollaborators(): CollaboratorPresence[] {
  const { collaborators } = useCollaboration();
  return collaborators;
}

export function useCollaborationStatus() {
  const { connected, ydoc } = useCollaboration();
  return {
    connected,
    hasDocument: ydoc !== null,
  };
}
