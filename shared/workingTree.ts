import type { WorkingTreeSnapshot } from './domain';

export type WorkingTreeAction = 'stage' | 'unstage' | 'discard';

export function canCommit(message: string, snapshot: WorkingTreeSnapshot): boolean {
  return message.trim().length > 0 && snapshot.staged.length > 0;
}

export function canStash(snapshot: WorkingTreeSnapshot): boolean {
  return snapshot.conflicts.length + snapshot.staged.length + snapshot.changes.length > 0;
}
