import assert from 'node:assert/strict';
import { workingTreeDiffSpec } from '../src/utils/workingTreeDiff.ts';

assert.deepEqual(workingTreeDiffSpec('staged', 'new.ts'), {
  left: { kind: 'git', ref: 'HEAD', path: 'new.ts' },
  right: { kind: 'git', ref: 'index', path: 'new.ts' },
});
assert.deepEqual(workingTreeDiffSpec('changes', 'new.ts'), {
  left: { kind: 'git', ref: 'index', path: 'new.ts' },
  right: { kind: 'file', path: 'new.ts' },
});
assert.deepEqual(workingTreeDiffSpec('staged', 'new.ts', 'old.ts'), {
  left: { kind: 'git', ref: 'HEAD', path: 'old.ts' },
  right: { kind: 'git', ref: 'index', path: 'new.ts' },
});
assert.deepEqual(workingTreeDiffSpec('conflicts', 'conflict.ts'), {
  mergePath: 'conflict.ts',
});

console.log('working tree diff checks passed');
