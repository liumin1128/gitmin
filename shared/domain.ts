/**
 * 领域类型：commit / 文件变更 / 仓库信息
 * extension 与 webview 两端共享，不引入任何运行时依赖
 */

export interface Commit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  parents: string[];
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
