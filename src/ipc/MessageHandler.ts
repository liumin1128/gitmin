/**
 * Webview 消息分发中枢
 * 单一入口 handle()，按 type 路由到对应业务方法
 * 业务方法内的错误统一转成 *error 消息回传
 */
import * as vscode from 'vscode';
import type { WebviewMessage, ExtensionMessage } from '../../shared/messages';
import type { Commit, DiffRange } from '../../shared/domain';
import { GitService } from '../services/GitService';
import { getActiveRepo, getGitApi } from '../services/RepoLocator';
import { computeDiffRange } from '../utils/diffRange';

export type PostMessage = (msg: ExtensionMessage) => void;

export class MessageHandler {
  private git: GitService | null = null;
  private commitsCache: Commit[] = [];
  private repoRoot: string | null = null;

  constructor(private readonly post: PostMessage) {}

  async handle(msg: WebviewMessage): Promise<void> {
    try {
      switch (msg.type) {
        case 'webview/ready':
          await this.initRepo();
          break;
        case 'commits/refresh':
          await this.loadCommits(msg.limit ?? 100);
          break;
        case 'diff/request':
          await this.loadDiff(msg.hashes);
          break;
        case 'file/openDiff':
          await this.openFileDiff(msg.range, msg.filePath);
          break;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[gitMgr] handle error:', message);
    }
  }

  private async initRepo(): Promise<void> {
    const repo = await getActiveRepo();
    if (!repo) {
      this.post({ type: 'repo/none', reason: '当前工作区未检测到 git 仓库' });
      return;
    }
    this.repoRoot = repo.rootPath;
    this.git = new GitService(repo.rootPath);
    this.post({
      type: 'repo/info',
      info: { rootPath: repo.rootPath, currentBranch: repo.currentBranch, hasCommits: true },
    });
    await this.loadCommits(100);
  }

  private async loadCommits(limit: number): Promise<void> {
    if (!this.git) return;
    try {
      const commits = await this.git.getLog(limit);
      this.commitsCache = commits;
      this.post({ type: 'commits/loaded', commits });
    } catch (e) {
      this.post({ type: 'commits/error', error: e instanceof Error ? e.message : String(e) });
    }
  }

  private async loadDiff(hashes: string[]): Promise<void> {
    if (!this.git) return;
    const range = computeDiffRange(hashes, this.commitsCache);
    if (!range) return;
    try {
      const files = await this.git.getDiffSummary(range.base, range.head);
      this.post({ type: 'diff/loaded', range, files });
    } catch (e) {
      this.post({ type: 'diff/error', error: e instanceof Error ? e.message : String(e) });
    }
  }

  private async openFileDiff(range: DiffRange, filePath: string): Promise<void> {
    if (!this.repoRoot) return;
    const api = await getGitApi();
    if (!api) return;
    const fullUri = vscode.Uri.joinPath(vscode.Uri.file(this.repoRoot), filePath);
    const leftUri = api.toGitUri(fullUri, range.base);
    const rightUri = api.toGitUri(fullUri, range.head);
    const title = `${filePath} (${range.base.slice(0, 7)}..${range.head.slice(0, 7)})`;
    await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
  }
}
