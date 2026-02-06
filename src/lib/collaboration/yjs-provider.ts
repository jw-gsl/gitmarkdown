import * as Y from 'yjs';

export interface CollaborationConfig {
  workspaceId: string;
  fileId: string;
  userId: string;
  userName: string;
  userColor: string;
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
];

export function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function createYjsDocument(): Y.Doc {
  return new Y.Doc();
}

export function getYjsDocContent(ydoc: Y.Doc): string {
  return ydoc.getText('content').toString();
}

export function setYjsDocContent(ydoc: Y.Doc, content: string): void {
  const ytext = ydoc.getText('content');
  ydoc.transact(() => {
    ytext.delete(0, ytext.length);
    ytext.insert(0, content);
  });
}
