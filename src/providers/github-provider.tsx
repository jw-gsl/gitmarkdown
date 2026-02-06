'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Workspace } from '@/types';

interface GitHubContextType {
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
}

const GitHubContext = createContext<GitHubContextType>({
  currentWorkspace: null,
  setCurrentWorkspace: () => {},
});

export function GitHubProvider({ children }: { children: ReactNode }) {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  return (
    <GitHubContext.Provider value={{ currentWorkspace, setCurrentWorkspace }}>
      {children}
    </GitHubContext.Provider>
  );
}

export function useGitHub() {
  return useContext(GitHubContext);
}
