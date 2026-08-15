import type { WorkingTreeGroup, WorkingTreeSnapshot } from './domain';

export type WorkingTreeAction = 'stage' | 'unstage' | 'discard';
export type CommitMessageLanguage = 'en' | 'zh';

export function workingTreeChangeKey(group: WorkingTreeGroup, path: string): string {
  return `${group}:${path}`;
}

export function workingTreeChangeCount(snapshot: WorkingTreeSnapshot): number {
  return snapshot.conflicts.length + snapshot.staged.length + snapshot.changes.length;
}

export function canCommit(message: string, snapshot: WorkingTreeSnapshot): boolean {
  return message.trim().length > 0 && snapshot.staged.length > 0;
}

export function canGenerateCommitMessage(snapshot: WorkingTreeSnapshot): boolean {
  return snapshot.staged.length > 0;
}

export function canStash(snapshot: WorkingTreeSnapshot): boolean {
  return workingTreeChangeCount(snapshot) > 0;
}
