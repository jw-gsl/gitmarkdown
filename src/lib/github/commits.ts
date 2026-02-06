import type { Octokit } from '@octokit/rest';
import type { GitHubCommit } from '@/types';

export async function listCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  options?: { path?: string; sha?: string; per_page?: number; includeStats?: boolean }
): Promise<GitHubCommit[]> {
  const { data } = await octokit.repos.listCommits({
    owner,
    repo,
    path: options?.path,
    sha: options?.sha,
    per_page: options?.per_page || 30,
  });
  const commits: GitHubCommit[] = data.map((c) => ({
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

  if (options?.includeStats) {
    const batch = commits.slice(0, 10);
    const results = await Promise.allSettled(
      batch.map((c) => octokit.repos.getCommit({ owner, repo, ref: c.sha }))
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        const detail = r.value.data;
        if (options.path) {
          // Per-file stats for the specific file
          const file = detail.files?.find((f) => f.filename === options.path);
          if (file) {
            batch[i].stats = { additions: file.additions ?? 0, deletions: file.deletions ?? 0 };
          }
        } else {
          batch[i].stats = {
            additions: detail.stats?.additions ?? 0,
            deletions: detail.stats?.deletions ?? 0,
          };
        }
      }
    }
  }

  return commits;
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
    stats: data.stats
      ? { additions: data.stats.additions ?? 0, deletions: data.stats.deletions ?? 0 }
      : undefined,
    files: (data.files || []).map((f) => ({
      filename: f.filename,
      status: f.status || 'modified',
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
      patch: f.patch,
    })),
  };
}
