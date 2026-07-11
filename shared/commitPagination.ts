import type { Commit } from './domain';

export const COMMIT_PAGE_SIZE = 50;

export interface CommitPage {
  requestId: number;
  offset: number;
  nextOffset: number;
  commits: Commit[];
  hasMore: boolean;
}

export function isNearCommitListBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number
): boolean {
  return scrollTop + clientHeight >= scrollHeight - 30;
}
