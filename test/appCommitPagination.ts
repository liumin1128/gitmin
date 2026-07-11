import assert from 'node:assert/strict';
import type { Commit } from '../shared/domain';
import type { CommitPage } from '../shared/commitPagination';
import {
  loadNextCommitPage,
  mergeCommitPage,
  resetCommitPage,
} from '../webview-ui/src/App';

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

pagination.nextOffsetRef.current = firstPage.nextOffset;
assert.equal(loadNextCommitPage(pagination, true, { branch: 'main' }, post), true);
assert.equal(loadNextCommitPage(pagination, true, { branch: 'main' }, post), false);
assert.deepEqual(requests.at(-1), {
  type: 'commits/refresh',
  requestId: 1,
  offset: 50,
  limit: 50,
  filters: { branch: 'main' },
});

console.log('app commit pagination checks passed');
