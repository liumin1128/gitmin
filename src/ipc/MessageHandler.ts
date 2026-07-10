/**
 * Webview 消息分发中枢
 * 单一入口 handle()，按 type 路由到对应业务方法
 * 业务方法内的错误统一转成 *error / action/result 消息回传
 */
import * as vscode from 'vscode';
import type { WebviewMessage, ExtensionMessage } from '../../shared/messages';
import type { Commit, CommitFilters, DiffRange } from '../../shared/domain';
import type { GitAction } from '../../shared/actions';
import { GitService } from '../services/GitService';
import { GitOpsService, type ResetMode } from '../services/GitOpsService';
import { getActiveRepo, getGitApi } from '../services/RepoLocator';
import { computeDiffRange } from '../utils/diffRange';
import { applySearch } from '../../shared/commitFilter';

export type PostMessage = (msg: ExtensionMessage) => void;

export class MessageHandler {
  private git: GitService | null = null;
  private ops: GitOpsService | null = null;
  private commitsCache: Commit[] = [];
  private repoRoot: string | null = null;
  private lastFilters: CommitFilters | undefined = undefined;

  constructor(
    private readonly post: PostMessage,
    private readonly extensionUri: vscode.Uri
  ) {}

  async handle(msg: WebviewMessage): Promise<void> {
    try {
      switch (msg.type) {
        case 'webview/ready':
          await this.initRepo();
          break;
        case 'commits/refresh':
          await this.loadCommits(msg.limit ?? 100, msg.filters);
          break;
        case 'filters/refresh':
          await this.loadFilterOptions();
          break;
        case 'diff/request':
          await this.loadDiff(msg.hashes);
          break;
        case 'file/openDiff':
          await this.openFileDiff(msg.range, msg.filePath);
          break;
        case 'action/execute':
          await this.handleAction(msg.action, msg.hashes);
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
    this.ops = new GitOpsService(repo.rootPath, this.extensionUri);
    this.post({
      type: 'repo/info',
      info: { rootPath: repo.rootPath, currentBranch: repo.currentBranch, hasCommits: true },
    });
    await this.loadCommits(100);
    await this.loadFilterOptions();
  }

  private async loadCommits(limit: number, filters?: CommitFilters): Promise<void> {
    if (!this.git) return;
    try {
      const raw = await this.git.getLog({ limit, filters });
      const commits = applySearch(raw, filters);
      this.commitsCache = commits;
      this.lastFilters = filters;
      this.post({ type: 'commits/loaded', commits });
    } catch (e) {
      this.post({ type: 'commits/error', error: e instanceof Error ? e.message : String(e) });
    }
  }

  private async loadFilterOptions(): Promise<void> {
    if (!this.git) return;
    try {
      const [branches, authors] = await Promise.all([
        this.git.getBranches(),
        this.git.getAuthors(),
      ]);
      this.post({ type: 'filters/options', options: { branches, authors } });
    } catch (e) {
      console.error('[gitMgr] loadFilterOptions error:', e);
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

  private async handleAction(action: GitAction, hashes: string[]): Promise<void> {
    if (!this.ops) return;

    // reset --hard 二次确认（可能丢失工作区改动）
    if (action === 'reset-hard') {
      const short = hashes[0]?.slice(0, 7) ?? '?';
      const answer = await vscode.window.showWarningMessage(
        `即将 git reset --hard 到 ${short}，会丢弃当前工作区所有未 commit 改动。确认？`,
        { modal: true },
        '继续'
      );
      if (answer !== '继续') {
        this.post({ type: 'action/result', action, ok: false, message: '已取消' });
        return;
      }
    }

    try {
      switch (action) {
        case 'copy-hash':
          await this.ops.copyHash(hashes);
          break;
        case 'revert':
          await this.ops.revert(hashes, this.commitsCache);
          break;
        case 'squash':
          await this.ops.squash(hashes, this.commitsCache);
          break;
        case 'drop':
          await this.ops.drop(hashes, this.commitsCache);
          break;
        case 'reset-soft':
        case 'reset-mixed':
        case 'reset-hard': {
          if (hashes.length !== 1) throw new Error('reset 只支持单选');
          const mode = action.slice('reset-'.length) as ResetMode;
          await this.ops.reset(mode, hashes[0]!);
          break;
        }
      }
      this.post({ type: 'action/result', action, ok: true });
      if (action !== 'copy-hash') {
        await this.loadCommits(100, this.lastFilters);
      } else {
        vscode.window.showInformationMessage(`已复制 ${hashes.length} 个 hash 到剪贴板`);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.post({ type: 'action/result', action, ok: false, message: err });
      vscode.window.showErrorMessage(`Git 操作失败：${err}`);
    }
  }
}
