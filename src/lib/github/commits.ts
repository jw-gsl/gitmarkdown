import type { Octokit } from '@octokit/rest';
import type { GitHubCommit } from '@/types';

export async function listCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  options?: { path?: string; sha?: string; per_page?: number }
): Promise<GitHubCommit[]> {
  const { data } = await octokit.repos.listCommits({
    owner,
    repo,
    path: options?.path,
    sha: options?.sha,
    per_page: options?.per_page || 30,
  });
  return data.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: {
      name: c.commit.author?.name || '',
      email: c.commit.author?.email || '',
      date: c.commit.author?.date || '',
      login: c.author?.login,
      avatar_url: c.author?.avatar_url,
    },
    committer: {
      name: c.commit.committer?.name || '',
      email: c.commit.committer?.email || '',
      date: c.commit.committer?.date || '',
    },
    html_url: c.html_url,
    parents: c.parents.map((p) => ({ sha: p.sha })),
  }));
}

export async function getCommit(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string
): Promise<GitHubCommit & { files: Array<{ filename: string; status: string; patch?: string }> }> {
  const { data } = await octokit.repos.getCommit({ owner, repo, ref: sha });
  return {
    sha: data.sha,
    message: data.commit.message,
    author: {
      name: data.commit.author?.name || '',
      email: data.commit.author?.email || '',
      date: data.commit.author?.date || '',
      login: data.author?.login,
      avatar_url: data.author?.avatar_url,
    },
    committer: {
      name: data.commit.committer?.name || '',
      email: data.commit.committer?.email || '',
      date: data.commit.committer?.date || '',
    },
    html_url: data.html_url,
    parents: data.parents.map((p) => ({ sha: p.sha })),
    files: (data.files || []).map((f) => ({
      filename: f.filename,
      status: f.status || 'modified',
      patch: f.patch,
    })),
  };
}
