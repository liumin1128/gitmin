import assert from 'node:assert/strict';
import { parseStashList } from '../src/utils/stashParser.ts';

const raw = [
  ['stash@{0}', 'abc123', 'parent0 index0', '2026-07-14T10:00:00+08:00', 'On main: checkpoint'].join('\0'),
  ['stash@{1}', 'def456', 'parent1 index1', '2026-07-13T10:00:00+08:00', 'WIP on main: 123 subject'].join('\0'),
].join('\x1e');
const entries = parseStashList(raw);

assert.equal(entries.length, 2);
assert.deepEqual(entries[0], {
  selector: 'stash@{0}',
  hash: 'abc123',
  parentHash: 'parent0',
  message: 'On main: checkpoint',
  date: '2026-07-14T10:00:00+08:00',
});
assert.deepEqual(parseStashList(''), []);
assert.deepEqual(parseStashList('broken\0record\x1e'), []);

console.log('stash parser checks passed');
