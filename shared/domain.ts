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

/**
 * commit 列表过滤条件
 * - branch/author/date/path 走 git log 原生参数
 * - search（含 hash 前缀 + message + regex + Cc）走服务端后置过滤
 */
export interface CommitFilters {
  search?: string;
  searchRegex?: boolean;
  searchCaseSensitive?: boolean;
  /** 空字符串或未设置 = 当前 HEAD；'__all__' = 所有分支 */
  branch?: string;
  /** 空字符串或未设置 = 所有作者 */
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

