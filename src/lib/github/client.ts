import { Octokit } from '@octokit/rest';

export function createOctokitClient(token: string): Octokit {
  return new Octokit({ auth: token });
}

export async function getGitHubToken(uid: string): Promise<string> {
  const response = await fetch('/api/auth/session', {
    method: 'GET',
    headers: { 'x-uid': uid },
  });
  if (!response.ok) throw new Error('Failed to get GitHub token');
  const data = await response.json();
  return data.token;
}
