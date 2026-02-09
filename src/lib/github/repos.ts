import type { Octokit } from '@octokit/rest';
import type { GitHubRepo } from '@/types';

export async function listUserRepos(octokit: Octokit): Promise<GitHubRepo[]> {
  const { data } = await octokit.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 100,
    type: 'all',
  });
  return data as unknown as GitHubRepo[];
}

export async function getRepo(octokit: Octokit, owner: string, repo: string): Promise<GitHubRepo> {
  const { data } = await octokit.repos.get({ owner, repo });
  return data as unknown as GitHubRepo;
}

export async function createRepo(
  octokit: Octokit,
  name: string,
  options: { description?: string; isPrivate?: boolean; autoInit?: boolean }
): Promise<GitHubRepo> {
  const { data } = await octokit.repos.createForAuthenticatedUser({
    name,
    description: options.description || undefined,
    private: options.isPrivate ?? true,
    auto_init: options.autoInit ?? true,
  });
  return data as unknown as GitHubRepo;
}
