/**
 * 修改历史类的 Git 操作
 * - 所有操作前检查工作区 clean（reset --hard 例外，UI 已二次确认）
 * - 交互式 rebase（squash/drop）通过 GIT_SEQUENCE_EDITOR 指向脚本自动改 todo
 * - 冲突或失败自动 rebase --abort，避免仓库残留 rebase 状态
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { simpleGit, type SimpleGit } from 'simple-git';
import type { Commit } from '../../shared/domain';

export type ResetMode = 'soft' | 'mixed' | 'hard';

export class GitOpsService {
  private readonly git: SimpleGit;
  private readonly editorScript: string;

  constructor(rootPath: string, extensionUri: vscode.Uri) {
    this.git = simpleGit(rootPath);
    this.editorScript = path.join(extensionUri.fsPath, 'resources', 'rebase-editor.js');
  }

  async copyHash(hashes: string[]): Promise<void> {
    await vscode.env.clipboard.writeText(hashes.join('\n'));
  }

  async revert(hashes: string[], allCommits: Commit[]): Promise<void> {
    await this.assertClean();
    const sorted = this.sortByAge(hashes, allCommits, 'newestFirst');
    for (const h of sorted) {
      try {
        await this.git.raw(['revert', '--no-edit', h]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(
          `revert ${h.slice(0, 7)} 失败：${msg}\n请手动解决冲突后 git revert --continue 或 --abort`
        );
      }
    }
  }

  async squash(hashes: string[], allCommits: Commit[]): Promise<void> {
    if (hashes.length < 2) throw new Error('至少选择 2 个 commit 才能 squash');
    await this.assertClean();
    const { oldest } = this.findOldestNewest(hashes, allCommits);
    const base = oldest.parents[0];
    if (!base) throw new Error('无法 squash 根 commit');
    await this.runInteractiveRebase(base, 'fixup', hashes);
  }

  async drop(hashes: string[], allCommits: Commit[]): Promise<void> {
    await this.assertClean();
    const { oldest } = this.findOldestNewest(hashes, allCommits);
    const base = oldest.parents[0];
    if (!base) throw new Error('无法 drop 根 commit');
    await this.runInteractiveRebase(base, 'drop', hashes);
  }

  async reset(mode: ResetMode, hash: string): Promise<void> {
    await this.git.raw(['reset', `--${mode}`, hash]);
  }

  // ===== 私有辅助 =====

  private async assertClean(): Promise<void> {
    const status = await this.git.status();
    if (!status.isClean()) {
      throw new Error('工作区有未提交改动，请先 commit 或 stash 后再操作');
    }
  }

  private findOldestNewest(hashes: string[], allCommits: Commit[]) {
    const indexMap = new Map(allCommits.map((c, i) => [c.hash, i]));
    const indices = hashes
      .map((h) => indexMap.get(h))
      .filter((v): v is number => v !== undefined);
    if (indices.length === 0) throw new Error('未找到指定 commit');
    const minIdx = Math.min(...indices);
    const maxIdx = Math.max(...indices);
    return { newest: allCommits[minIdx]!, oldest: allCommits[maxIdx]! };
  }

  private sortByAge(
    hashes: string[],
    allCommits: Commit[],
    order: 'newestFirst' | 'oldestFirst'
  ): string[] {
    const indexMap = new Map(allCommits.map((c, i) => [c.hash, i]));
    const filtered = hashes.filter((h) => indexMap.has(h));
    return filtered.sort((a, b) => {
      const ia = indexMap.get(a)!;
      const ib = indexMap.get(b)!;
      return order === 'newestFirst' ? ia - ib : ib - ia;
    });
  }

  private async runInteractiveRebase(
    base: string,
    action: 'fixup' | 'drop',
    targetHashes: string[]
  ): Promise<void> {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_SEQUENCE_EDITOR: `node "${this.editorScript}"`,
      GITMGR_REBASE_ACTION: action,
      GITMGR_TARGET_HASHES: targetHashes.join(','),
    };
    try {
      await this.git.env(env).raw(['rebase', '-i', base]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        await this.git.raw(['rebase', '--abort']);
      } catch {
        // 忽略 abort 本身的错
      }
      throw new Error(`rebase 失败：${msg}\n已尝试 abort，请检查仓库状态`);
    }
  }
}
