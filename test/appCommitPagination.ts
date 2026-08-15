import assert from 'node:assert/strict';
import type { Commit } from '../shared/domain';
import type { CommitPage } from '../shared/commitPagination';
import {
  completeCommitPage,
  failCommitPage,
  loadNextCommitPage,
  mergeCommitPage,
  queueCommitReset,
  resetCommitPage,
  retryFailedCommitPage,
  settleInitialCommitLoad,
} from '../webview-ui/src/utils/commitPaging';

const commits = [{ hash: 'one' }, { hash: 'two' }] as Commit[];
const firstPage: CommitPage = {
  requestId: 1,
  offset: 0,
  nextOffset: 50,
  commits: [commits[0]!],
  hasMore: true,
};
const nextPage: CommitPage = {
  requestId: 1,
  offset: 50,
  nextOffset: 75,
  commits: [commits[1]!],
  hasMore: false,
};

assert.deepEqual(mergeCommitPage(commits, firstPage), [commits[0]!]);
assert.deepEqual(mergeCommitPage([commits[0]!], nextPage), commits);

const pagination = {
  requestIdRef: { current: 0 },
  nextOffsetRef: { current: 0 },
  loadingMoreRef: { current: false },
  pendingOffsetRef: { current: null as number | null },
};
const requests: unknown[] = [];
const post = (request: unknown) => requests.push(request);

resetCommitPage(pagination, { branch: 'main' }, post);
assert.deepEqual(requests, [
  {
    type: 'commits/refresh',
    requestId: 1,
    offset: 0,
    limit: 50,
    filters: { branch: 'main' },
  },
]);
assert.equal(pagination.loadingMoreRef.current, true);
assert.equal(pagination.pendingOffsetRef.current, 0);
assert.equal(loadNextCommitPage(pagination, true, { branch: 'main' }, post), false);

assert.equal(completeCommitPage(pagination, firstPage), true);
assert.equal(pagination.loadingMoreRef.current, false);
assert.equal(pagination.pendingOffsetRef.current, null);

assert.equal(loadNextCommitPage(pagination, true, { branch: 'main' }, post), true);
assert.equal(loadNextCommitPage(pagination, true, { branch: 'main' }, post), false);
assert.deepEqual(requests.at(-1), {
  type: 'commits/refresh',
  requestId: 1,
  offset: 50,
  limit: 50,
  filters: { branch: 'main' },
});

const failedOffsetRef = { current: failCommitPage(pagination, 1) };
assert.equal(failedOffsetRef.current, 50);
assert.equal(
  retryFailedCommitPage(pagination, failedOffsetRef, { branch: 'main' }, post),
  true,
  'a failed page can retry at its original offset without resetting the session'
);
assert.deepEqual(requests.at(-1), {
  type: 'commits/refresh',
  requestId: 1,
  offset: 50,
  limit: 50,
  filters: { branch: 'main' },
});
assert.equal(failedOffsetRef.current, null);
assert.equal(pagination.loadingMoreRef.current, true);
assert.equal(pagination.pendingOffsetRef.current, 50);
assert.equal(
  retryFailedCommitPage(pagination, failedOffsetRef, { branch: 'main' }, post),
  false,
  'the in-flight lock suppresses duplicate retry clicks'
);

let displayedCommits = mergeCommitPage([commits[0]!], nextPage);
let displayedHasMore = nextPage.hasMore;
let displayedLoadingMore = true;
const resetRequests: unknown[] = [];

resetCommitPage(pagination, { author: 'Ada' }, (request) => {
  resetRequests.push({
    request,
    displayedCommits,
    displayedHasMore,
    displayedLoadingMore,
    loadingLocked: pagination.loadingMoreRef.current,
  });
}, () => {
  displayedCommits = [];
  displayedHasMore = true;
  displayedLoadingMore = false;
});

assert.deepEqual(resetRequests, [
  {
    request: {
      type: 'commits/refresh',
      requestId: 2,
      offset: 0,
      limit: 50,
      filters: { author: 'Ada' },
    },
    displayedCommits: [],
    displayedHasMore: true,
    displayedLoadingMore: false,
    loadingLocked: true,
  },
]);
assert.equal(pagination.requestIdRef.current, 2);
assert.equal(pagination.nextOffsetRef.current, 0);
assert.equal(pagination.loadingMoreRef.current, true);
assert.equal(pagination.pendingOffsetRef.current, 0);

assert.equal(
  completeCommitPage(pagination, { ...firstPage, requestId: 1 }),
  false,
  'a page from a prior session must be ignored'
);
assert.equal(
  completeCommitPage(pagination, { ...nextPage, requestId: 2 }),
  false,
  'a same-session page for a different offset must not replace the reset page'
);
assert.equal(pagination.loadingMoreRef.current, true);
assert.equal(pagination.pendingOffsetRef.current, 0);
assert.equal(completeCommitPage(pagination, { ...firstPage, requestId: 2 }), true);

const initialLoadGate = {
  settledRef: { current: false },
  queuedFiltersRef: { current: null as { branch?: string } | null },
};
const queuedResets: unknown[] = [];
const dispatchReset = (filters: { branch?: string }) => queuedResets.push(filters);

assert.equal(queueCommitReset(initialLoadGate, { branch: 'main' }, dispatchReset), false);
assert.equal(queueCommitReset(initialLoadGate, { branch: 'release' }, dispatchReset), false);
assert.deepEqual(queuedResets, []);
settleInitialCommitLoad(initialLoadGate, dispatchReset);
assert.deepEqual(queuedResets, [{ branch: 'release' }]);
assert.equal(queueCommitReset(initialLoadGate, { branch: 'main' }, dispatchReset), true);
assert.deepEqual(queuedResets, [{ branch: 'release' }, { branch: 'main' }]);

console.log('app commit pagination checks passed');
