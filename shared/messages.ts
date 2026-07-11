/**
 * Extension <-> Webview IPC 协议
 * 采用 discriminated union，两端类型一致
 */
import type {
  CommitDetails,
  FileChange,
  RepoInfo,
  DiffRange,
  CommitFilters,
  FilterOptions,
} from './domain';
import type { GitAction } from './actions';
import type { CommitPage } from './commitPagination';

// ===== Webview -> Extension =====
export type WebviewMessage =
  | { type: 'webview/ready'; filters?: CommitFilters; requestId: number; limit: number }
  | {
      type: 'commits/refresh';
      requestId: number;
      offset: number;
      limit: number;
      filters?: CommitFilters;
    }
  | { type: 'filters/refresh' }
  | { type: 'commitDetails/request'; hashes: string[] }
  | { type: 'diff/request'; hashes: string[] }
  | { type: 'file/openDiff'; range: DiffRange; filePath: string }
  | { type: 'action/execute'; action: GitAction; hashes: string[]; squashMessage?: string };

// ===== Extension -> Webview =====
export type ExtensionMessage =
  | { type: 'repo/info'; info: RepoInfo }
  | { type: 'repo/none'; reason: string }
  | { type: 'commits/loaded'; page: CommitPage }
  | { type: 'commits/error'; requestId: number; error: string }
  | { type: 'filters/restored'; filters: CommitFilters }
  | { type: 'filters/options'; options: FilterOptions }
  | { type: 'commitDetails/loaded'; hashes: string[]; details: CommitDetails[] }
  | { type: 'commitDetails/error'; hashes: string[]; error: string }
  | { type: 'diff/loaded'; range: DiffRange; files: FileChange[] }
  | { type: 'diff/activeFile'; filePath: string | null }
  | { type: 'diff/error'; error: string }
  | { type: 'action/result'; action: GitAction; ok: boolean; message?: string };
