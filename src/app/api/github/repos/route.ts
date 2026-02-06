import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createOctokitClient } from '@/lib/github/client';
import { listUserRepos } from '@/lib/github/repos';
import { decrypt } from '@/app/api/auth/session/route';

async function getOctokitFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization header');
  }
  const idToken = authHeader.split('Bearer ')[1];
  const decoded = await adminAuth.verifyIdToken(idToken);
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  const encryptedToken = userDoc.data()?.encryptedGithubToken;
  if (!encryptedToken) throw new Error('No GitHub token found');
  const githubToken = decrypt(encryptedToken);
  return createOctokitClient(githubToken);
}

export async function GET(request: NextRequest) {
  try {
    const octokit = await getOctokitFromRequest(request);
    const repos = await listUserRepos(octokit);
    return NextResponse.json(repos);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch repos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
