/**
 * 复用 vscode.git 内置扩展 API 定位仓库与生成 diff URI
 * 单例封装，activate 时缓存 API 引用
 */
import * as vscode from 'vscode';

export interface RepositoryLocation {
  rootPath: string;
  currentBranch: string;
}

/** vscode.git API 的最小类型描述，避免引入完整 .d.ts */
export interface GitApi {
  repositories: Array<{
    rootUri: vscode.Uri;
    state: { HEAD?: { name?: string } };
  }>;
  toGitUri(uri: vscode.Uri, ref: string): vscode.Uri;
  onDidOpenRepository: vscode.Event<unknown>;
}

let cachedApi: GitApi | null = null;

async function ensureGitApi(): Promise<GitApi | null> {
  if (cachedApi) return cachedApi;
  const ext = vscode.extensions.getExtension('vscode.git');
  if (!ext) return null;
  const exports = ext.isActive ? ext.exports : await ext.activate();
  cachedApi = exports.getAPI(1) as GitApi;

  // 首次激活时 repositories 可能还未加载，等一小段时间
  if (cachedApi.repositories.length === 0) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        disposable.dispose();
        resolve();
      }, 3000);
      const disposable = cachedApi!.onDidOpenRepository(() => {
        clearTimeout(timer);
        disposable.dispose();
        resolve();
      });
    });
  }
  return cachedApi;
}

export async function getActiveRepo(): Promise<RepositoryLocation | null> {
  const api = await ensureGitApi();
  if (!api) return null;
  const repo = api.repositories[0];
  if (!repo) return null;
  return {
    rootPath: repo.rootUri.fsPath,
    currentBranch: repo.state.HEAD?.name ?? '(detached)',
  };
}

export async function getGitApi(): Promise<GitApi | null> {
  return ensureGitApi();
}
