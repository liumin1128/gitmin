import assert from 'node:assert/strict';
import { parseCommitDetailsOutput } from '../src/utils/commitDetailsParser.ts';

const record = (fields: string[]) => `${fields.join('\x00')}\x1e`;
const output = [
  record([
    'hash-1',
    'short-1',
    'tree-1',
    'parent-a parent-b',
    'HEAD -> main, tag: v1.0.0',
    'feat: detailed commit',
    'Body line 1\nBody line 2',
    'Alice',
    'alice@example.com',
    '2026-07-12T09:00:00+08:00',
    'Bob',
    'bob@example.com',
    '2026-07-12T10:00:00+08:00',
    'UTF-8',
    'G',
    'Alice Signer',
    'ABC123',
  ]),
  record([
    'hash-2', 'short-2', 'tree-2', '', '', 'fix: root', '',
    'Carol', 'carol@example.com', '2026-07-11T09:00:00+08:00',
    'Carol', 'carol@example.com', '2026-07-11T09:01:00+08:00',
    '', 'N', '', '',
  ]),
].join('');

const details = parseCommitDetailsOutput(output);
assert.equal(details.length, 2);
assert.deepEqual(details[0], {
  hash: 'hash-1',
  shortHash: 'short-1',
  treeHash: 'tree-1',
  parents: ['parent-a', 'parent-b'],
  refs: ['HEAD -> main', 'tag: v1.0.0'],
  subject: 'feat: detailed commit',
  body: 'Body line 1\nBody line 2',
  author: {
    name: 'Alice',
    email: 'alice@example.com',
    date: '2026-07-12T09:00:00+08:00',
  },
  committer: {
    name: 'Bob',
    email: 'bob@example.com',
    date: '2026-07-12T10:00:00+08:00',
  },
  encoding: 'UTF-8',
  signature: { status: 'G', signer: 'Alice Signer', key: 'ABC123' },
});
assert.deepEqual(details[1]?.parents, []);
assert.deepEqual(details[1]?.refs, []);
assert.deepEqual(details[1]?.signature, { status: 'N', signer: '', key: '' });
assert.deepEqual(parseCommitDetailsOutput(''), []);

console.log('commit detail parser checks passed');
