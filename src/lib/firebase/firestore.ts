import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QueryConstraint,
  addDoc,
  limit,
} from 'firebase/firestore';
import { db } from './config';
import type { Workspace, FileNode, Comment } from '@/types';

// Workspaces
export async function createWorkspace(data: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = doc(collection(db, 'workspaces'));
  await setDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const snap = await getDoc(doc(db, 'workspaces', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Workspace;
}

export async function getUserWorkspaces(uid: string): Promise<Workspace[]> {
  const q = query(
    collection(db, 'workspaces'),
    where(`members.${uid}.role`, 'in', ['owner', 'editor', 'viewer'])
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workspace);
}

export async function updateWorkspace(id: string, data: Partial<Workspace>) {
  await updateDoc(doc(db, 'workspaces', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// Files
export async function saveFile(workspaceId: string, file: Omit<FileNode, 'id'>) {
  const fileId = file.path.replace(/\//g, '__');
  await setDoc(doc(db, 'workspaces', workspaceId, 'files', fileId), {
    ...file,
    updatedAt: serverTimestamp(),
  });
  return fileId;
}

export async function getFile(workspaceId: string, filePath: string): Promise<FileNode | null> {
  const fileId = filePath.replace(/\//g, '__');
  const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'files', fileId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FileNode;
}

export async function getWorkspaceFiles(workspaceId: string): Promise<FileNode[]> {
  const snap = await getDocs(collection(db, 'workspaces', workspaceId, 'files'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FileNode);
}

// Comments
export async function addComment(
  workspaceId: string,
  fileId: string,
  comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>
) {
  const ref = await addDoc(
    collection(db, 'workspaces', workspaceId, 'files', fileId, 'comments'),
    {
      ...comment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );
  return ref.id;
}

export async function getComments(workspaceId: string, fileId: string): Promise<Comment[]> {
  const q = query(
    collection(db, 'workspaces', workspaceId, 'files', fileId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment);
}

export function subscribeToComments(
  workspaceId: string,
  fileId: string,
  callback: (comments: Comment[]) => void
) {
  const q = query(
    collection(db, 'workspaces', workspaceId, 'files', fileId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment);
    callback(comments);
  });
}

export async function updateComment(
  workspaceId: string,
  fileId: string,
  commentId: string,
  data: Partial<Comment>
) {
  await updateDoc(
    doc(db, 'workspaces', workspaceId, 'files', fileId, 'comments', commentId),
    { ...data, updatedAt: serverTimestamp() }
  );
}

export async function deleteComment(workspaceId: string, fileId: string, commentId: string) {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'files', fileId, 'comments', commentId));
}

// Versions
export async function saveVersion(workspaceId: string, version: { sha: string; message: string; author: string; authorAvatar?: string; date: string; filesChanged: string[] }) {
  await setDoc(doc(db, 'workspaces', workspaceId, 'versions', version.sha), version);
}

export async function getVersions(workspaceId: string, maxResults = 50) {
  const q = query(
    collection(db, 'workspaces', workspaceId, 'versions'),
    orderBy('date', 'desc'),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// ── Flat-collection comment helpers (no workspaceId required) ──────────
// Comments are stored in a top-level "comments" collection, keyed by
// repoFullName (owner/repo) + filePath so the editor page can read/write
// them without resolving a workspace first.

export function subscribeToFileComments(
  owner: string,
  repo: string,
  filePath: string,
  onUpdate: (comments: Comment[]) => void
) {
  const commentsRef = collection(db, 'comments');
  const q = query(
    commentsRef,
    where('repoFullName', '==', `${owner}/${repo}`),
    where('filePath', '==', filePath),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as Timestamp | null)?.toDate() ?? new Date(),
      updatedAt: (d.data().updatedAt as Timestamp | null)?.toDate() ?? new Date(),
    })) as Comment[];
    onUpdate(comments);
  });
}

export async function addFileComment(
  owner: string,
  repo: string,
  filePath: string,
  comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>
) {
  const commentsRef = collection(db, 'comments');
  return addDoc(commentsRef, {
    ...comment,
    repoFullName: `${owner}/${repo}`,
    filePath,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateFileComment(
  commentId: string,
  updates: Partial<Comment>
) {
  const commentRef = doc(db, 'comments', commentId);
  return updateDoc(commentRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFileComment(commentId: string) {
  const commentRef = doc(db, 'comments', commentId);
  return deleteDoc(commentRef);
}

export { db };
