/**
 * Commit pagination state machine (pure functions, no React).
 * Pages are requested by offset; stale or out-of-order responses are ignored
 * by tracking the current requestId and the pending offset.
 */
import type { Commit, CommitFilters } from '../../../shared/domain';
import type { WebviewMessage } from '../../../shared/messages';
import { COMMIT_PAGE_SIZE, type CommitPage } from '../../../shared/commitPagination';

export type CommitPageRequest = Extract<WebviewMessage, { type: 'commits/refresh' }>;

export interface CommitPaginationRefs {
  requestIdRef: { current: number };
  nextOffsetRef: { current: number };
  loadingMoreRef: { current: boolean };
  pendingOffsetRef: { current: number | null };
}

export interface InitialCommitLoadGate {
  settledRef: { current: boolean };
  queuedFiltersRef: { current: CommitFilters | null };
}

export type PostCommitPageRequest = (request: CommitPageRequest) => void;

export function mergeCommitPage(commits: Commit[], page: CommitPage): Commit[] {
  return page.offset === 0 ? page.commits : [...commits, ...page.commits];
}

export function startCommitPageSession(pagination: CommitPaginationRefs): number {
  pagination.requestIdRef.current += 1;
  pagination.nextOffsetRef.current = 0;
  pagination.loadingMoreRef.current = true;
  pagination.pendingOffsetRef.current = 0;
  return pagination.requestIdRef.current;
}

export function requestCommitPage(
  requestId: number,
  offset: number,
  filters: CommitFilters,
  post: PostCommitPageRequest
): void {
  post({ type: 'commits/refresh', requestId, offset, limit: COMMIT_PAGE_SIZE, filters });
}

export function resetCommitPage(
  pagination: CommitPaginationRefs,
  filters: CommitFilters,
  post: PostCommitPageRequest,
  beforeRequest: () => void = () => undefined
): number {
  const requestId = startCommitPageSession(pagination);
  beforeRequest();
  requestCommitPage(requestId, 0, filters, post);
  return requestId;
}

export function loadNextCommitPage(
  pagination: CommitPaginationRefs,
  hasMore: boolean,
  filters: CommitFilters,
  post: PostCommitPageRequest
): boolean {
  if (pagination.loadingMoreRef.current || !hasMore) return false;

  pagination.loadingMoreRef.current = true;
  pagination.pendingOffsetRef.current = pagination.nextOffsetRef.current;
  requestCommitPage(
    pagination.requestIdRef.current,
    pagination.nextOffsetRef.current,
    filters,
    post
  );
  return true;
}

export function completeCommitPage(pagination: CommitPaginationRefs, page: CommitPage): boolean {
  if (
    page.requestId !== pagination.requestIdRef.current ||
    page.offset !== pagination.pendingOffsetRef.current
  ) {
    return false;
  }

  pagination.nextOffsetRef.current = page.nextOffset;
  pagination.pendingOffsetRef.current = null;
  pagination.loadingMoreRef.current = false;
  return true;
}

export function failCommitPage(
  pagination: CommitPaginationRefs,
  requestId: number
): number | null {
  if (requestId !== pagination.requestIdRef.current || pagination.pendingOffsetRef.current === null) {
    return null;
  }

  const failedOffset = pagination.pendingOffsetRef.current;
  pagination.pendingOffsetRef.current = null;
  pagination.loadingMoreRef.current = false;
  return failedOffset;
}

export function retryFailedCommitPage(
  pagination: CommitPaginationRefs,
  failedOffsetRef: { current: number | null },
  filters: CommitFilters,
  post: PostCommitPageRequest
): boolean {
  const failedOffset = failedOffsetRef.current;
  if (pagination.loadingMoreRef.current || failedOffset === null) return false;

  pagination.loadingMoreRef.current = true;
  pagination.pendingOffsetRef.current = failedOffset;
  failedOffsetRef.current = null;
  requestCommitPage(pagination.requestIdRef.current, failedOffset, filters, post);
  return true;
}

export function queueCommitReset(
  gate: InitialCommitLoadGate,
  filters: CommitFilters,
  dispatchReset: (filters: CommitFilters) => void
): boolean {
  if (!gate.settledRef.current) {
    gate.queuedFiltersRef.current = filters;
    return false;
  }

  dispatchReset(filters);
  return true;
}

export function settleInitialCommitLoad(
  gate: InitialCommitLoadGate,
  dispatchReset: (filters: CommitFilters) => void
): void {
  if (gate.settledRef.current) return;

  gate.settledRef.current = true;
  const filters = gate.queuedFiltersRef.current;
  gate.queuedFiltersRef.current = null;
  if (filters) dispatchReset(filters);
}
