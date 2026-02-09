// GitHub types
export interface GitHubUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  githubUsername: string;
  githubAccessToken?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  private: boolean;
  default_branch: string;
  updated_at: string;
  language: string | null;
  html_url: string;
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: string;
  type: 'file' | 'dir';
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
    login?: string;
    avatar_url?: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  html_url: string;
  parents: { sha: string }[];
  stats?: { additions: number; deletions: number };
}

export interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
}

export interface GitHubReviewComment {
  id: number;
  body: string;
  path: string;
  line: number | null;
  start_line: number | null;
  user: { login: string; avatar_url: string; id: number } | null;
  in_reply_to_id?: number;
  diff_hunk: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface ActivePR {
  number: number;
  headSha: string;
  baseRef: string;
  htmlUrl: string;
}

// Workspace types
export interface Workspace {
  id: string;
  repoFullName: string;
  repoId: number;
  owner: string;
  repo: string;
  defaultBranch: string;
  members: Record<string, WorkspaceMember>;
  syncSettings: SyncSettings;
  lastSyncedCommitSha: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: Date;
}

export interface SyncSettings {
  autoSync: boolean;
  syncBranch: string;
  syncInterval: number; // minutes
}

// File types
export interface FileNode {
  id: string;
  path: string;
  name: string;
  type: 'file' | 'directory';
  sha?: string;
  size?: number;
  isMarkdown: boolean;
  children?: FileNode[];
  lastModifiedBy?: string;
  content?: string;
}

export type SyncStatus = 'synced' | 'local-changes' | 'remote-changes' | 'conflict' | 'syncing' | 'error';

// Comment types
export interface Comment {
  id: string;
  fileId: string;
  author: {
    uid: string;
    displayName: string;
    photoURL: string | null;
    githubUsername: string;
  };
  content: string;
  type: 'comment' | 'suggestion';
  anchorStart: number;
  anchorEnd: number;
  anchorText: string;
  reactions: Record<string, string[]>; // emoji -> uid[]
  parentCommentId: string | null;
  githubCommentId: string | null;
  githubThreadId?: string | null;
  status: 'active' | 'resolved';
  branch?: string;
  suggestion?: {
    originalText: string;
    suggestedText: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// AI types
export type AIProvider = 'anthropic' | 'openai';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  fileMentions?: string[];
}

export interface AIEditRequest {
  instruction: string;
  selectedText: string;
  context: string;
  filePath: string;
}

export interface AIEditResponse {
  original: string;
  edited: string;
  explanation: string;
}

// Pending file operations (queued locally, executed on commit)
export type PendingFileOp =
  | { type: 'create'; path: string; content: string }
  | { type: 'delete'; path: string; sha: string }
  | { type: 'rename'; oldPath: string; newPath: string; sha: string; content: string }
  | { type: 'move'; oldPath: string; newPath: string; sha: string; content: string }
  | { type: 'duplicate'; newPath: string; content: string };

// Editor types
export interface EditorState {
  isReady: boolean;
  isDirty: boolean;
  wordCount: number;
  characterCount: number;
}

// Collaboration types
export interface CollaboratorPresence {
  uid: string;
  displayName: string;
  photoURL: string | null;
  color: string;
  cursor?: {
    anchor: number;
    head: number;
  };
  lastActive: number;
}

// Template types
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  content: string;
}

// Version types
export interface Version {
  sha: string;
  message: string;
  author: string;
  authorAvatar?: string;
  date: string;
  filesChanged: string[];
}
