import assert from 'node:assert/strict';
import { toWorkingTreeSnapshot } from '../src/utils/workingTreeStatus.ts';
import { canCommit, canGenerateCommitMessage, canStash } from '../shared/workingTree.ts';

const snapshot = toWorkingTreeSnapshot([
  { path: 'both.ts', index: 'M', working_dir: 'M' },
  { path: 'new.ts', index: '?', working_dir: '?' },
  { path: 'conflict.ts', index: 'U', working_dir: 'U' },
  { path: 'renamed.ts', from: 'old.ts', index: 'R', working_dir: ' ' },
  { path: 'typed.ts', index: 'T', working_dir: ' ' },
]);

assert.deepEqual(snapshot.staged.map((file) => file.path), ['both.ts', 'renamed.ts', 'typed.ts']);
assert.deepEqual(snapshot.changes.map((file) => file.path), ['both.ts', 'new.ts']);
assert.deepEqual(snapshot.conflicts.map((file) => file.path), ['conflict.ts']);
assert.equal(snapshot.staged[1]?.oldPath, 'old.ts');
assert.equal(snapshot.staged[2]?.status, 'T');
assert.equal(canCommit('message', snapshot), true);
assert.equal(canCommit('   ', snapshot), false);
assert.equal(canCommit('message', { conflicts: [], staged: [], changes: [] }), false);
assert.equal(canGenerateCommitMessage(snapshot), true);
assert.equal(canGenerateCommitMessage({ conflicts: [], staged: [], changes: [] }), false);
assert.equal(canStash(snapshot), true);
assert.equal(canStash({ conflicts: [], staged: [], changes: [] }), false);

console.log('working tree checks passed');
