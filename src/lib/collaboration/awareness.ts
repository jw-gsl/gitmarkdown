import type { CollaboratorPresence } from '@/types';

export function createPresenceData(
  uid: string,
  displayName: string,
  photoURL: string | null,
  color: string
): CollaboratorPresence {
  return {
    uid,
    displayName,
    photoURL,
    color,
    lastActive: Date.now(),
  };
}

export function isPresenceActive(presence: CollaboratorPresence, timeout = 30000): boolean {
  return Date.now() - presence.lastActive < timeout;
}

export function filterActivePresences(
  presences: CollaboratorPresence[],
  currentUid: string,
  timeout = 30000
): CollaboratorPresence[] {
  return presences.filter(
    (p) => p.uid !== currentUid && isPresenceActive(p, timeout)
  );
}
