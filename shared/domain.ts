/**
 * Domain types: commit / file changes / repo info
 * Shared between extension and webview, no runtime dependencies
 */

export interface Commit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  parents: string[];
  /** Ref names attached to this commit (tags, branches like origin/main, etc.) */
  refs: string[];
}

export interface CommitIdentity {
  name: string;
  email: string;
  date: string;
}

export interface CommitSignature {
  status: string;
  signer: string;
  key: string;
}

export interface CommitDetails {
  hash: string;
  shortHash: string;
  treeHash: string;
  parents: string[];
  refs: string[];
  subject: string;
  body: string;
  author: CommitIdentity;
  committer: CommitIdentity;
  encoding: string;
  signature: CommitSignature;
}

export type FileStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | '?';

export interface FileChange {
  path: string;
  oldPath?: string;
  status: FileStatus;
  insertions: number;
  deletions: number;
  binary: boolean;
}

export interface RepoInfo {
  rootPath: string;
  currentBranch: string;
  hasCommits: boolean;
}

export interface DiffRange {
  base: string;
  head: string;
  contiguous: boolean;
}

/**
 * Commit list filter criteria
 * - branch/author/date/path use git log native parameters
 * - search (hash prefix + message + regex + case-sensitive) uses server-side post-filtering
 */
export interface CommitFilters {
  search?: string;
  searchRegex?: boolean;
  searchCaseSensitive?: boolean;
  /** Empty or unset = current HEAD; '__all__' = all branches */
  branch?: string;
  /** Empty or unset = all authors */
  author?: string;
  /** yyyy-MM-dd */
  dateAfter?: string;
  /** yyyy-MM-dd */
  dateBefore?: string;
}

export interface FilterOptions {
  branches: string[];
  authors: string[];
}
