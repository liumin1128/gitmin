/**
 * Reuse vscode.git built-in extension API to locate repos and generate diff URIs
 * Singleton wrapper, caches API reference on activate
 */
import * as vscode from 'vscode';

export interface RepositoryLocation {
  rootPath: string;
  currentBranch: string;
}

export interface GitRepository {
  rootUri: vscode.Uri;
  state: {
    HEAD?: { name?: string };
    onDidChange: vscode.Event<void>;
  };
}

/** Minimal type description for the vscode.git API, avoiding full .d.ts import */
export interface GitApi {
  repositories: GitRepository[];
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

  // Repositories may not be loaded on first activation, wait a bit
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

export async function getActiveRepository(): Promise<GitRepository | null> {
  const api = await ensureGitApi();
  return api?.repositories[0] ?? null;
}
