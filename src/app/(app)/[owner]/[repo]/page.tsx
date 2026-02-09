'use client';

import { useParams, useRouter } from 'next/navigation';
import { WelcomeScreen } from '@/components/editor/welcome-screen';
import { useSyncStore } from '@/stores/sync-store';
import { useCallback } from 'react';

export default function RepoPage() {
  const params = useParams();
  const router = useRouter();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const currentBranch = useSyncStore((s) => s.currentBranch);
  const baseBranch = useSyncStore((s) => s.baseBranch);

  const handleOpenFile = useCallback(
    (path: string) => {
      let url = `/${owner}/${repo}/${path}`;
      if (currentBranch && currentBranch !== baseBranch) {
        url += `?branch=${encodeURIComponent(currentBranch)}`;
      }
      router.push(url);
    },
    [owner, repo, currentBranch, baseBranch, router]
  );

  return <WelcomeScreen owner={owner} repo={repo} onOpenFile={handleOpenFile} />;
}
