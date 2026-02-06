import type { Octokit } from '@octokit/rest';
import type { GitHubBranch } from '@/types';

export async function listBranches(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  const { data } = await octokit.repos.listBranches({ owner, repo, per_page: 100 });
  return data as GitHubBranch[];
}

export async function createBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string,
  fromSha: string
): Promise<void> {
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: fromSha,
  });
}

export async function getBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubBranch> {
  const { data } = await octokit.repos.getBranch({ owner, repo, branch });
  return data as unknown as GitHubBranch;
}
