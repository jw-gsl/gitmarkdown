import { useCallback, useRef } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { useSyncStore } from '@/stores/sync-store';
import { useGitHubBranches } from '@/hooks/use-github';
import { toast } from 'sonner';

/**
 * Hook that manages auto-branch creation when saveStrategy is 'branch'.
 * Creates a new branch before the first auto-save of a session, then
 * subsequent saves go to that branch.
 */
export function useAutoBranch(owner: string, repo: string) {
  const saveStrategy = useSettingsStore((s) => s.saveStrategy);
  const autoBranchPrefix = useSettingsStore((s) => s.autoBranchPrefix);
  const { currentBranch, setCurrentBranch, setBranches } = useSyncStore();
  const { fetchBranches, createBranch } = useGitHubBranches();
  const sessionBranchRef = useRef<string | null>(null);

  const ensureBranch = useCallback(async () => {
    if (saveStrategy !== 'branch') return currentBranch;

    // If we already created a branch this session, reuse it
    if (sessionBranchRef.current) return sessionBranchRef.current;

    // Create a new branch from the current branch
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');
    const branchName = `${autoBranchPrefix}${timestamp}`;

    try {
      const branchList = await fetchBranches(owner, repo);
      const current = branchList?.find(
        (b: { name: string; sha: string }) => b.name === currentBranch
      );
      if (!current) {
        toast.error('Could not find current branch to create auto-branch');
        return currentBranch;
      }

      await createBranch(owner, repo, branchName, current.sha);
      sessionBranchRef.current = branchName;

      // Refresh branches and switch
      const updated = await fetchBranches(owner, repo);
      if (updated) {
        setBranches(updated.map((br: { name: string }) => br.name));
      }
      setCurrentBranch(branchName);
      toast.success(`Auto-created branch: ${branchName}`);
      return branchName;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create auto-branch';
      toast.error(msg);
      return currentBranch;
    }
  }, [saveStrategy, autoBranchPrefix, currentBranch, owner, repo, fetchBranches, createBranch, setBranches, setCurrentBranch]);

  const resetSession = useCallback(() => {
    sessionBranchRef.current = null;
  }, []);

  return { ensureBranch, resetSession, isAutoBranch: saveStrategy === 'branch' };
}
