/**
 * Extension <-> Webview IPC protocol
 * Uses discriminated union, consistent types on both ends
 */
import type {
  CommitDetails,
  FileChange,
  RepoInfo,
  DiffRange,
  CommitFilters,
  DetailSelection,
  FilterOptions,
  StashEntry,
  WorkingTreeGroup,
  WorkingTreeSnapshot,
} from './domain';
import type { GitAction } from './actions';
import type { CommitPage } from './commitPagination';
import type { WorkingTreeAction } from './workingTree';
import type { RepositorySnapshot } from './repositories';

export type RefreshTarget = 'changes' | 'commits' | 'stashes';
export type GitWorkspaceOperation =
  | WorkingTreeAction
  | 'commit'
  | 'stash'
  | 'apply-stash'
  | 'delete-stash';

// ===== Webview -> Extension =====
export type WebviewMessage =
  | { type: 'webview/ready'; filters?: CommitFilters; requestId: number; limit: number }
  | { type: 'repositories/select'; rootPath: string }
  | { type: 'repositories/load'; requestId: number; limit: number }
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
  | { type: 'workingTree/request'; requestId: number }
  | {
      type: 'workingTree/action';
      requestId: number;
      action: WorkingTreeAction;
      group: WorkingTreeGroup;
      paths: string[];
    }
  | { type: 'workingTree/commit'; requestId: number; message: string }
  | { type: 'workingTree/generateCommitMessage'; requestId: number }
  | { type: 'workingTree/stash'; requestId: number; message: string }
  | { type: 'workingTree/openDiff'; group: WorkingTreeGroup; path: string }
  | { type: 'stashes/request'; requestId: number }
  | {
      type: 'stashes/action';
      requestId: number;
      action: 'apply' | 'delete';
      selector: string;
      hash: string;
    }
  | { type: 'selectionDetails/request'; requestId: number; selection: DetailSelection }
  | { type: 'selectionDetails/clear' }
  | { type: 'action/execute'; action: GitAction; hashes: string[]; squashMessage?: string };

// ===== Extension -> Webview =====
export type ExtensionMessage =
  | { type: 'repo/info'; info: RepoInfo }
  | { type: 'repositories/loaded'; snapshot: RepositorySnapshot }
  | { type: 'repositories/selectionChanged'; rootPath: string | null }
  | { type: 'repositories/error'; error: string }
  | { type: 'workbenchViews/menuToggle' }
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
  | { type: 'workingTree/loaded'; requestId: number; snapshot: WorkingTreeSnapshot }
  | { type: 'workingTree/error'; requestId: number; error: string }
  | { type: 'workingTree/changed' }
  | {
      type: 'workingTree/actionResult';
      requestId: number;
      operation: GitWorkspaceOperation;
      ok: boolean;
      message?: string;
      refresh: RefreshTarget[];
    }
  | {
      type: 'workingTree/commitMessageResult';
      requestId: number;
      ok: boolean;
      message?: string;
      model?: string;
      error?: string;
      cancelled?: boolean;
    }
  | { type: 'stashes/loaded'; requestId: number; entries: StashEntry[] }
  | { type: 'stashes/error'; requestId: number; error: string }
  | {
      type: 'selectionDetails/loaded';
      requestId: number;
      selection: DetailSelection;
      range: DiffRange;
      files: FileChange[];
      details: CommitDetails[];
    }
  | {
      type: 'selectionDetails/error';
      requestId: number;
      selection: DetailSelection;
      error: string;
    }
  | { type: 'action/result'; action: GitAction; ok: boolean; message?: string };
