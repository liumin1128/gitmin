import { simpleGit, type SimpleGit } from 'simple-git';
import type { WorkingTreeGroup, WorkingTreeSnapshot } from '../../shared/domain';
import { toWorkingTreeSnapshot } from '../utils/workingTreeStatus';

export class WorkingTreeService {
  private readonly git: SimpleGit;

  constructor(rootPath: string) {
    this.git = simpleGit(rootPath);
  }

  async getSnapshot(): Promise<WorkingTreeSnapshot> {
    const status = await this.git.status();
    return toWorkingTreeSnapshot(status.files);
  }

  async stage(paths: string[]): Promise<void> {
    const targetPaths = uniquePaths(paths);
    if (targetPaths.length === 0) return;
    await this.git.raw(['add', '--', ...targetPaths]);
  }

  async unstage(paths: string[]): Promise<void> {
    const targetPaths = uniquePaths(paths);
    if (targetPaths.length === 0) return;
    await this.git.raw(['reset', 'HEAD', '--', ...targetPaths]);
  }

  async discard(group: WorkingTreeGroup, paths: string[]): Promise<void> {
    const targetPaths = uniquePaths(paths);
    if (targetPaths.length === 0) return;

    if (group === 'changes') {
      const snapshot = await this.getSnapshot();
      const requested = new Set(targetPaths);
      const untracked = snapshot.changes
        .filter((change) => requested.has(change.path) && change.status === '?')
        .map((change) => change.path);
      const untrackedSet = new Set(untracked);
      const tracked = targetPaths.filter((path) => !untrackedSet.has(path));
      if (tracked.length > 0) {
        await this.git.raw(['restore', '--worktree', '--', ...tracked]);
      }
      if (untracked.length > 0) {
        await this.git.raw(['clean', '-fd', '--', ...untracked]);
      }
      return;
    }

    await this.git.raw([
      'restore',
      '--source=HEAD',
      '--staged',
      '--worktree',
      '--',
      ...targetPaths,
    ]);
  }

  async commit(message: string): Promise<void> {
    if (!message.trim()) throw new Error('Commit message is required');
    const snapshot = await this.getSnapshot();
    if (snapshot.staged.length === 0) throw new Error('No staged changes to commit');
    await this.git.raw(['commit', '-m', message]);
  }

  async getStagedDiff(): Promise<string> {
    const diff = await this.git.raw([
      'diff',
      '--cached',
      '--no-ext-diff',
      '--unified=3',
      '--',
    ]);
    if (!diff.trim()) throw new Error('No staged changes to generate a commit message from');
    return diff;
  }

  async createStash(message: string): Promise<string> {
    const trimmed = message.trim();
    return this.git.raw(trimmed ? ['stash', 'push', '-m', trimmed] : ['stash']);
  }
}

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths.filter((path) => path.length > 0))];
}
