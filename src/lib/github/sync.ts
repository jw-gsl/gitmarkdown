import type { Octokit } from '@octokit/rest';

interface FileChange {
  path: string;
  content: string;
  mode?: string;
}

export async function multiFileCommit(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: FileChange[]
): Promise<string> {
  // Get the latest commit SHA for the branch
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const latestCommitSha = ref.object.sha;

  // Get the tree SHA of the latest commit
  const { data: commit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha,
  });
  const baseTreeSha = commit.tree.sha;

  // Create blobs for each file
  const tree = await Promise.all(
    files.map(async (file) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64',
      });
      return {
        path: file.path,
        mode: (file.mode || '100644') as '100644',
        type: 'blob' as const,
        sha: blob.sha,
      };
    })
  );

  // Create new tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree,
  });

  // Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: [latestCommitSha],
  });

  // Update branch reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

  return newCommit.sha;
}

export async function detectConflicts(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  lastKnownSha: string
): Promise<{ hasConflicts: boolean; aheadBy: number; behindBy: number }> {
  try {
    const { data } = await octokit.repos.compareCommits({
      owner,
      repo,
      base: lastKnownSha,
      head: branch,
    });
    return {
      hasConflicts: data.status === 'diverged',
      aheadBy: data.ahead_by,
      behindBy: data.behind_by,
    };
  } catch {
    return { hasConflicts: false, aheadBy: 0, behindBy: 0 };
  }
}
