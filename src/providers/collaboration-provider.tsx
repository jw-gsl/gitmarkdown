'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import * as Y from 'yjs';
import { createYjsDocument } from '@/lib/collaboration/yjs-provider';
import type { CollaboratorPresence } from '@/types';

interface CollaborationContextType {
  ydoc: Y.Doc | null;
  connected: boolean;
  collaborators: CollaboratorPresence[];
}

const CollaborationContext = createContext<CollaborationContextType>({
  ydoc: null,
  connected: false,
  collaborators: [],
});

interface CollaborationProviderProps {
  children: ReactNode;
  workspaceId: string;
  fileId: string;
}

export function CollaborationProvider({ children, workspaceId, fileId }: CollaborationProviderProps) {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [connected, setConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);

  useEffect(() => {
    const doc = createYjsDocument();
    setYdoc(doc);
    setConnected(true);

    return () => {
      doc.destroy();
      setConnected(false);
    };
  }, [workspaceId, fileId]);

  return (
    <CollaborationContext.Provider value={{ ydoc, connected, collaborators }}>
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaboration() {
  return useContext(CollaborationContext);
}
