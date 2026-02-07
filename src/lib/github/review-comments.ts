import type { Octokit } from '@octokit/rest';
import type { GitHubReviewComment, GitHubPullRequest } from '@/types';

export async function listReviewComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  path?: string
): Promise<GitHubReviewComment[]> {
  const { data } = await octokit.pulls.listReviewComments({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  const comments = data as unknown as GitHubReviewComment[];
  if (path) {
    return comments.filter((c) => c.path === path);
  }
  return comments;
}

export async function createReviewComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  params: {
    body: string;
    commitId: string;
    path: string;
    line: number;
    startLine?: number;
  }
): Promise<GitHubReviewComment> {
  const requestParams: Record<string, unknown> = {
    owner,
    repo,
    pull_number: pullNumber,
    body: params.body,
    commit_id: params.commitId,
    path: params.path,
    line: params.line,
  };

  if (params.startLine && params.startLine !== params.line) {
    requestParams.start_line = params.startLine;
    requestParams.start_side = 'RIGHT';
    requestParams.side = 'RIGHT';
  }

  const { data } = await octokit.pulls.createReviewComment(
    requestParams as Parameters<typeof octokit.pulls.createReviewComment>[0]
  );
  return data as unknown as GitHubReviewComment;
}

export async function replyToReviewComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  commentId: number,
  body: string
): Promise<GitHubReviewComment> {
  const { data } = await octokit.pulls.createReplyForReviewComment({
    owner,
    repo,
    pull_number: pullNumber,
    comment_id: commentId,
    body,
  });
  return data as unknown as GitHubReviewComment;
}

export async function updateReviewComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  body: string
): Promise<GitHubReviewComment> {
  const { data } = await octokit.pulls.updateReviewComment({
    owner,
    repo,
    comment_id: commentId,
    body,
  });
  return data as unknown as GitHubReviewComment;
}

export async function deleteReviewComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number
): Promise<void> {
  await octokit.pulls.deleteReviewComment({
    owner,
    repo,
    comment_id: commentId,
  });
}

export async function addReactionToComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  content: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes'
): Promise<void> {
  await octokit.reactions.createForPullRequestReviewComment({
    owner,
    repo,
    comment_id: commentId,
    content,
  });
}

export interface ThreadInfo {
  isResolved: boolean;
  threadId: string; // GraphQL node ID for resolve/unresolve mutations
  reactions: Array<{ databaseId: number; content: string; userLogin: string }>;
}

/**
 * Fetch thread details (resolution status, thread IDs, reactions) for a PR via GraphQL.
 * Returns a map of each comment's databaseId → ThreadInfo.
 */
export async function fetchThreadDetails(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<Map<number, ThreadInfo>> {
  const result = new Map<number, ThreadInfo>();
  try {
    const response = await octokit.graphql<{
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: Array<{
              id: string;
              isResolved: boolean;
              comments: {
                nodes: Array<{
                  databaseId: number;
                  reactions: {
                    nodes: Array<{
                      databaseId: number;
                      content: string;
                      user: { login: string } | null;
                    }>;
                  };
                }>;
              };
            }>;
          };
        };
      };
    }>(
      `query($owner: String!, $repo: String!, $pullNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $pullNumber) {
            reviewThreads(first: 100) {
              nodes {
                id
                isResolved
                comments(first: 100) {
                  nodes {
                    databaseId
                    reactions(first: 100) {
                      nodes {
                        databaseId
                        content
                        user { login }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { owner, repo, pullNumber }
    );
    const threads = response.repository.pullRequest.reviewThreads.nodes;
    for (const thread of threads) {
      for (const comment of thread.comments.nodes) {
        result.set(comment.databaseId, {
          isResolved: thread.isResolved,
          threadId: thread.id,
          reactions: comment.reactions.nodes.map((r) => ({
            databaseId: r.databaseId,
            content: r.content,
            userLogin: r.user?.login || '',
          })),
        });
      }
    }
  } catch {
    // GraphQL may fail if token lacks permissions; silently ignore
  }
  return result;
}

/**
 * Resolve a review thread on GitHub via GraphQL.
 */
export async function resolveThread(
  octokit: Octokit,
  threadId: string
): Promise<void> {
  await octokit.graphql(
    `mutation($threadId: ID!) {
      resolveReviewThread(input: { threadId: $threadId }) {
        thread { id }
      }
    }`,
    { threadId }
  );
}

/**
 * Unresolve a review thread on GitHub via GraphQL.
 */
export async function unresolveThread(
  octokit: Octokit,
  threadId: string
): Promise<void> {
  await octokit.graphql(
    `mutation($threadId: ID!) {
      unresolveReviewThread(input: { threadId: $threadId }) {
        thread { id }
      }
    }`,
    { threadId }
  );
}

/**
 * Delete a reaction from a PR review comment.
 * Requires the reaction's database ID.
 */
export async function deleteReactionFromComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  reactionId: number
): Promise<void> {
  await octokit.reactions.deleteForPullRequestComment({
    owner,
    repo,
    comment_id: commentId,
    reaction_id: reactionId,
  });
}

/**
 * List reactions on a PR review comment.
 */
export async function listReactionsForComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number
): Promise<Array<{ id: number; content: string; user: { login: string } }>> {
  const { data } = await octokit.reactions.listForPullRequestReviewComment({
    owner,
    repo,
    comment_id: commentId,
    per_page: 100,
  });
  return data.map((r) => ({
    id: r.id,
    content: r.content,
    user: { login: r.user?.login || '' },
  }));
}

export async function findPRForBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string
): Promise<{ number: number; headSha: string; baseRef: string; htmlUrl: string } | null> {
  const { data: pulls } = await octokit.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${branchName}`,
    per_page: 1,
  });

  if (pulls.length === 0) return null;

  const pr = pulls[0] as unknown as GitHubPullRequest;
  return {
    number: pr.number,
    headSha: pr.head.sha,
    baseRef: pr.base.ref,
    htmlUrl: pr.html_url,
  };
}
