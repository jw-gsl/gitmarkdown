import type { Octokit } from '@octokit/rest';
import type { GitHubContent, GitHubTreeItem } from '@/types';

export async function getRepoTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<GitHubTreeItem[]> {
  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: 'true',
  });
  return data.tree as GitHubTreeItem[];
}

export async function getFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<GitHubContent> {
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });
  return data as unknown as GitHubContent;
}

export async function updateFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha: string,
  branch?: string
): Promise<{ sha: string; commitSha: string }> {
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString('base64'),
    sha,
    branch,
  });
  return {
    sha: data.content?.sha || '',
    commitSha: data.commit.sha || '',
  };
}

export async function createFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch?: string
): Promise<{ sha: string; commitSha: string }> {
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
  });
  return {
    sha: data.content?.sha || '',
    commitSha: data.commit.sha || '',
  };
}
