import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createOctokitClient } from '@/lib/github/client';
import { decrypt } from '@/app/api/auth/session/route';

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, fileId, owner, repo, pullNumber, direction } = await request.json();

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const encryptedToken = userDoc.data()?.encryptedGithubToken;
    if (!encryptedToken) {
      return NextResponse.json({ error: 'No GitHub token' }, { status: 401 });
    }

    const octokit = createOctokitClient(decrypt(encryptedToken));

    if (direction === 'to-github') {
      // Get Firestore comments and push to GitHub PR
      const commentsRef = adminDb
        .collection('workspaces')
        .doc(workspaceId)
        .collection('files')
        .doc(fileId)
        .collection('comments');

      const snapshot = await commentsRef.where('githubCommentId', '==', null).get();

      for (const doc of snapshot.docs) {
        const comment = doc.data();
        const { data: ghComment } = await octokit.pulls.createReviewComment({
          owner,
          repo,
          pull_number: pullNumber,
          body: comment.content,
          commit_id: 'HEAD',
          path: comment.filePath || fileId,
          line: 1,
        });

        await doc.ref.update({ githubCommentId: ghComment.id.toString() });
      }
    } else {
      // Pull GitHub PR comments into Firestore
      const { data: ghComments } = await octokit.pulls.listReviewComments({
        owner,
        repo,
        pull_number: pullNumber,
      });

      const commentsRef = adminDb
        .collection('workspaces')
        .doc(workspaceId)
        .collection('files')
        .doc(fileId)
        .collection('comments');

      for (const ghComment of ghComments) {
        const existing = await commentsRef.where('githubCommentId', '==', ghComment.id.toString()).get();
        if (existing.empty) {
          await commentsRef.add({
            author: {
              uid: `github-${ghComment.user?.login}`,
              displayName: ghComment.user?.login || 'Unknown',
              photoURL: ghComment.user?.avatar_url || null,
              githubUsername: ghComment.user?.login || '',
            },
            content: ghComment.body,
            type: 'comment',
            anchorText: ghComment.diff_hunk?.split('\n').pop() || '',
            anchorStart: 0,
            anchorEnd: 0,
            reactions: {},
            parentCommentId: null,
            githubCommentId: ghComment.id.toString(),
            status: 'active',
            createdAt: new Date(ghComment.created_at),
            updatedAt: new Date(ghComment.updated_at),
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Comment sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
