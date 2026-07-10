/**
 * 纯函数 sanity check：验证核心逻辑无回归
 * 运行：node --experimental-strip-types test/sanity.mts
 */
import assert from 'node:assert/strict';
import {
  parseLogLine,
  parseLogOutput,
  parseNameStatus,
  parseNumstat,
  mergeFileChanges,
} from '../src/utils/commitParser.ts';
import { computeDiffRange, EMPTY_TREE_HASH } from '../src/utils/diffRange.ts';
import {
  selectSingle,
  toggleSelection,
  selectRange,
} from '../webview-ui/src/utils/selection.ts';
import { relativeTime, shortHash, firstLine } from '../webview-ui/src/utils/formatters.ts';

// ===== commitParser =====
{
  const line = 'abc123def\x00abc123d\x00feat: hello\x00Alice\x00alice@example.com\x002026-01-01T10:00:00Z\x00parent1 parent2';
  const c = parseLogLine(line);
  assert.equal(c.hash, 'abc123def');
  assert.equal(c.shortHash, 'abc123d');
  assert.equal(c.message, 'feat: hello');
  assert.equal(c.author, 'Alice');
  assert.deepEqual(c.parents, ['parent1', 'parent2']);
}
{
  const commits = parseLogOutput(
    'h1\x00sh1\x00m1\x00a1\x00e1\x00d1\x00p1\nh2\x00sh2\x00m2\x00a2\x00e2\x00d2\x00'
  );
  assert.equal(commits.length, 2);
  assert.deepEqual(commits[1].parents, []); // 根 commit 无 parent
}
{
  const map = parseNameStatus('A\tfoo.ts\nM\tbar.ts\nD\tbaz.ts\nR100\told.ts\tnew.ts');
  assert.equal(map.get('foo.ts')?.status, 'A');
  assert.equal(map.get('bar.ts')?.status, 'M');
  assert.equal(map.get('baz.ts')?.status, 'D');
  assert.equal(map.get('new.ts')?.status, 'R');
  assert.equal(map.get('new.ts')?.oldPath, 'old.ts');
}
{
  const map = parseNumstat('10\t3\tfoo.ts\n-\t-\timg.png');
  assert.equal(map.get('foo.ts')?.insertions, 10);
  assert.equal(map.get('foo.ts')?.deletions, 3);
  assert.equal(map.get('foo.ts')?.binary, false);
  assert.equal(map.get('img.png')?.binary, true);
}
{
  const statuses = parseNameStatus('A\tfoo.ts\nM\tbar.ts');
  const stats = parseNumstat('5\t1\tfoo.ts\n2\t2\tbar.ts');
  const merged = mergeFileChanges(statuses, stats);
  assert.equal(merged.length, 2);
  const foo = merged.find((f) => f.path === 'foo.ts')!;
  assert.equal(foo.status, 'A');
  assert.equal(foo.insertions, 5);
  assert.equal(foo.deletions, 1);
}

// ===== diffRange =====
{
  const commits = [
    { hash: 'c3', shortHash: 'c3', message: '', author: '', email: '', date: '', parents: ['c2'] },
    { hash: 'c2', shortHash: 'c2', message: '', author: '', email: '', date: '', parents: ['c1'] },
    { hash: 'c1', shortHash: 'c1', message: '', author: '', email: '', date: '', parents: ['c0'] },
    { hash: 'c0', shortHash: 'c0', message: '', author: '', email: '', date: '', parents: [] },
  ];
  // 单选 c2：base=c1, head=c2
  const r1 = computeDiffRange(['c2'], commits);
  assert.deepEqual(r1, { base: 'c1', head: 'c2', contiguous: true });

  // 连续多选 c3,c2：base=c1(=c2.parents[0]), head=c3
  const r2 = computeDiffRange(['c3', 'c2'], commits);
  assert.deepEqual(r2, { base: 'c1', head: 'c3', contiguous: true });

  // 不连续 c3,c1：base=c0, head=c3, contiguous=false
  const r3 = computeDiffRange(['c3', 'c1'], commits);
  assert.equal(r3?.contiguous, false);
  assert.equal(r3?.head, 'c3');
  assert.equal(r3?.base, 'c0');

  // 根 commit c0：base=空树 hash
  const r4 = computeDiffRange(['c0'], commits);
  assert.equal(r4?.base, EMPTY_TREE_HASH);
  assert.equal(r4?.head, 'c0');

  // 空选择
  assert.equal(computeDiffRange([], commits), null);
}

// ===== selection =====
{
  const items = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual([...selectSingle('c')], ['c']);
  assert.deepEqual([...toggleSelection(new Set(['a']), 'b')].sort(), ['a', 'b']);
  assert.deepEqual([...toggleSelection(new Set(['a', 'b']), 'a')], ['b']);
  assert.deepEqual([...selectRange(items, 'b', 'd')].sort(), ['b', 'c', 'd']);
  assert.deepEqual([...selectRange(items, 'd', 'b')].sort(), ['b', 'c', 'd']);
  assert.deepEqual([...selectRange(items, null, 'c')], ['c']);
}

// ===== formatters =====
{
  assert.equal(shortHash('abcdef1234567'), 'abcdef1');
  assert.equal(firstLine('line1\nline2'), 'line1');
  assert.equal(firstLine('single'), 'single');
  const now = new Date('2026-01-01T00:00:00Z');
  assert.equal(relativeTime('2025-12-31T23:59:00Z', now), '1m ago');
  assert.equal(relativeTime('2025-12-31T00:00:00Z', now), '1d ago');
}

console.log('✅ all sanity checks passed');
