import type { Octokit } from '@octokit/rest';
import type { GitHubPullRequest } from '@/types';

export async function createPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
): Promise<GitHubPullRequest> {
  const { data } = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
  });
  return data as unknown as GitHubPullRequest;
}

export async function listPullRequests(
  octokit: Octokit,
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open'
): Promise<GitHubPullRequest[]> {
  const { data } = await octokit.pulls.list({
    owner,
    repo,
    state,
    per_page: 30,
  });
  return data as unknown as GitHubPullRequest[];
}
