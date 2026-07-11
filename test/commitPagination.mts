import assert from 'node:assert/strict';
import {
  COMMIT_PAGE_SIZE,
  isNearCommitListBottom,
} from '../shared/commitPagination.ts';
import { buildLogArgs, normalizeLogPagination } from '../src/services/GitService.ts';
import { CommitRequestGuard } from '../src/ipc/CommitRequestGuard.ts';

assert.equal(COMMIT_PAGE_SIZE, 50);
assert.equal(isNearCommitListBottom(69, 100, 200), false);
assert.equal(isNearCommitListBottom(70, 100, 200), true);

const pagedLogArgs = buildLogArgs(50, 100);
assert.deepEqual(
  pagedLogArgs.slice(pagedLogArgs.indexOf('--skip'), pagedLogArgs.indexOf('--skip') + 4),
  ['--skip', '100', '-n', '50']
);
assert.deepEqual(normalizeLogPagination(0, -100), {
  limit: COMMIT_PAGE_SIZE,
  offset: 0,
});

const requestGuard = new CommitRequestGuard();
assert.equal(requestGuard.reserve(1, 0), true);
assert.equal(requestGuard.reserve(1, 0), false);
assert.equal(requestGuard.complete(1, 0, 50), true);
assert.equal(requestGuard.reserve(1, 100), false);
assert.equal(requestGuard.reserve(1, 50), true);
assert.equal(requestGuard.reserve(1, 50), false);
assert.equal(requestGuard.complete(1, 50, 150), true);
assert.equal(requestGuard.reserve(1, 150), true);
assert.equal(requestGuard.reserve(2, 0), true);
assert.equal(requestGuard.reserve(1, 150), false);

console.log('commit pagination checks passed');
