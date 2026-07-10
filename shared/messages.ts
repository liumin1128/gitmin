/**
 * Extension <-> Webview IPC 协议
 * 采用 discriminated union，两端类型一致
 */
import type { Commit, FileChange, RepoInfo, DiffRange } from './domain';
import type { GitAction } from './actions';

// ===== Webview -> Extension =====
export type WebviewMessage =
  | { type: 'webview/ready' }
  | { type: 'commits/refresh'; limit?: number }
  | { type: 'diff/request'; hashes: string[] }
  | { type: 'file/openDiff'; range: DiffRange; filePath: string }
  | { type: 'action/execute'; action: GitAction; hashes: string[] };

// ===== Extension -> Webview =====
export type ExtensionMessage =
  | { type: 'repo/info'; info: RepoInfo }
  | { type: 'repo/none'; reason: string }
  | { type: 'commits/loaded'; commits: Commit[] }
  | { type: 'commits/error'; error: string }
  | { type: 'diff/loaded'; range: DiffRange; files: FileChange[] }
  | { type: 'diff/error'; error: string }
  | { type: 'action/result'; action: GitAction; ok: boolean; message?: string };
