import assert from 'node:assert/strict';
import {
  acceptsResponse,
  commitSelection,
  stashSelection,
} from '../webview-ui/src/utils/detailSelection.ts';

assert.deepEqual(commitSelection(['b', 'a']), { kind: 'commits', hashes: ['a', 'b'] });
assert.equal(commitSelection([]), null);
assert.deepEqual(stashSelection({ selector: 'stash@{0}', hash: 'abc' }), {
  kind: 'stash',
  selector: 'stash@{0}',
  hash: 'abc',
});
assert.equal(stashSelection(null), null);
assert.equal(acceptsResponse(4, 4), true);
assert.equal(acceptsResponse(3, 4), false);

console.log('detail selection checks passed');
