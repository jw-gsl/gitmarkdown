'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import type { GitHubRepo, GitHubTreeItem, GitHubContent, GitHubCommit, GitHubBranch } from '@/types';

function useGitHubFetch() {
  const { user } = useAuth();

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      if (!user) throw new Error('Not authenticated');
      const idToken = await user.getIdToken();
      const res = await fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Request failed');
      }
      return res.json();
    },
    [user]
  );

  return fetchWithAuth;
}

export function useGitHubRepos() {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchWithAuth = useGitHubFetch();

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWithAuth('/api/github/repos');
      setRepos(data);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  return { repos, loading, fetchRepos };
}

export function useGitHubTree() {
  const [tree, setTree] = useState<GitHubTreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchWithAuth = useGitHubFetch();

  const fetchTree = useCallback(
    async (owner: string, repo: string, branch?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ owner, repo });
        if (branch) params.set('branch', branch);
        const data = await fetchWithAuth(`/api/github/tree?${params}`);
        setTree(data);
        return data;
      } finally {
        setLoading(false);
      }
    },
    [fetchWithAuth]
  );

  return { tree, loading, fetchTree };
}

export function useGitHubContent() {
  const [loading, setLoading] = useState(false);
  const fetchWithAuth = useGitHubFetch();

  const fetchContent = useCallback(
    async (owner: string, repo: string, path: string, ref?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ owner, repo, path });
        if (ref) params.set('ref', ref);
        const data: GitHubContent = await fetchWithAuth(`/api/github/contents?${params}`);
        return data;
      } finally {
        setLoading(false);
      }
    },
    [fetchWithAuth]
  );

  const updateContent = useCallback(
    async (owner: string, repo: string, path: string, content: string, message: string, sha: string, branch?: string) => {
      return fetchWithAuth('/api/github/contents', {
        method: 'PUT',
        body: JSON.stringify({ owner, repo, path, content, message, sha, branch }),
      });
    },
    [fetchWithAuth]
  );

  const createContent = useCallback(
    async (owner: string, repo: string, path: string, content: string, message: string, branch?: string) => {
      return fetchWithAuth('/api/github/contents', {
        method: 'POST',
        body: JSON.stringify({ owner, repo, path, content, message, branch }),
      });
    },
    [fetchWithAuth]
  );

  return { loading, fetchContent, updateContent, createContent };
}

export function useGitHubCommits() {
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchWithAuth = useGitHubFetch();

  const fetchCommits = useCallback(
    async (owner: string, repo: string, path?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ owner, repo });
        if (path) params.set('path', path);
        const data = await fetchWithAuth(`/api/github/commits?${params}`);
        setCommits(data);
        return data;
      } finally {
        setLoading(false);
      }
    },
    [fetchWithAuth]
  );

  const fetchCommit = useCallback(
    async (owner: string, repo: string, sha: string) => {
      return fetchWithAuth(`/api/github/commits?owner=${owner}&repo=${repo}&commitSha=${sha}`);
    },
    [fetchWithAuth]
  );

  return { commits, loading, fetchCommits, fetchCommit };
}

export function useGitHubBranches() {
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchWithAuth = useGitHubFetch();

  const fetchBranches = useCallback(
    async (owner: string, repo: string) => {
      setLoading(true);
      try {
        const data = await fetchWithAuth(`/api/github/branches?owner=${owner}&repo=${repo}`);
        setBranches(data);
        return data;
      } finally {
        setLoading(false);
      }
    },
    [fetchWithAuth]
  );

  const createBranch = useCallback(
    async (owner: string, repo: string, branchName: string, fromSha: string) => {
      return fetchWithAuth('/api/github/branches', {
        method: 'POST',
        body: JSON.stringify({ owner, repo, branchName, fromSha }),
      });
    },
    [fetchWithAuth]
  );

  return { branches, loading, fetchBranches, createBranch };
}
