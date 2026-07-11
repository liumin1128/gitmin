import assert from 'node:assert/strict';
import {
  COMMIT_PAGE_SIZE,
  isNearCommitListBottom,
} from '../shared/commitPagination.ts';

assert.equal(COMMIT_PAGE_SIZE, 50);
assert.equal(isNearCommitListBottom(69, 100, 200), false);
assert.equal(isNearCommitListBottom(70, 100, 200), true);

console.log('commit pagination checks passed');
