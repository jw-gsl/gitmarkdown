import type { Octokit } from '@octokit/rest';

export interface CompareFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'changed';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface CompareCommit {
  sha: string;
  message: string;
}

export interface CompareResult {
  files: CompareFile[];
  commits: CompareCommit[];
  totalCommits: number;
  aheadBy: number;
}

export async function compareBranches(
  octokit: Octokit,
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<CompareResult> {
  const { data } = await octokit.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${base}...${head}`,
  });

  return {
    files: (data.files ?? []).map((f) => ({
      filename: f.filename,
      status: f.status as CompareFile['status'],
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    })),
    commits: data.commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
    })),
    totalCommits: data.total_commits,
    aheadBy: data.ahead_by,
  };
}
