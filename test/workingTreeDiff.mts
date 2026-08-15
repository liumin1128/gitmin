import assert from 'node:assert/strict';
import { workingTreeDiffSpec } from '../src/utils/workingTreeDiff.ts';
import { diffSideRef, EMPTY_TREE_HASH } from '../src/utils/diffRange.ts';

assert.deepEqual(workingTreeDiffSpec('staged', 'new.ts'), {
  left: { kind: 'git', ref: 'HEAD', path: 'new.ts' },
  right: { kind: 'git', ref: '~', path: 'new.ts' },
});
assert.deepEqual(workingTreeDiffSpec('changes', 'new.ts'), {
  left: { kind: 'git', ref: '~', path: 'new.ts' },
  right: { kind: 'file', path: 'new.ts' },
});
assert.deepEqual(workingTreeDiffSpec('staged', 'new.ts', 'old.ts'), {
  left: { kind: 'git', ref: 'HEAD', path: 'old.ts' },
  right: { kind: 'git', ref: '~', path: 'new.ts' },
});
assert.deepEqual(workingTreeDiffSpec('conflicts', 'conflict.ts'), {
  mergePath: 'conflict.ts',
});

assert.equal(diffSideRef('A', 'left', 'abc'), EMPTY_TREE_HASH);
assert.equal(diffSideRef('A', 'right', 'abc'), 'abc');
assert.equal(diffSideRef('M', 'left', 'abc'), 'abc');
assert.equal(diffSideRef('D', 'right', 'abc'), EMPTY_TREE_HASH);
assert.equal(diffSideRef('R', 'left', 'abc'), 'abc');
assert.equal(diffSideRef('?', 'left', '~'), EMPTY_TREE_HASH);
assert.equal(diffSideRef('M', 'right', ''), '');
assert.equal(diffSideRef('D', 'right', ''), EMPTY_TREE_HASH);

console.log('working tree diff checks passed');
