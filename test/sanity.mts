/**
 * Pure function sanity check: verify no regression in core logic
 * Run: node --experimental-strip-types test/sanity.mts
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
import { applySearch, isValidSearch } from '../shared/commitFilter.ts';
import { layoutCommits } from '../webview-ui/src/utils/commitGraph.ts';
import { getAdjacentFileChange } from '../src/utils/diffNavigation.ts';

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
  assert.deepEqual(commits[1].parents, []); // root commit has no parent
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
  // Single select c2: base=c1, head=c2
  const r1 = computeDiffRange(['c2'], commits);
  assert.deepEqual(r1, { base: 'c1', head: 'c2', contiguous: true });

  // Contiguous multi-select c3,c2: base=c1(=c2.parents[0]), head=c3
  const r2 = computeDiffRange(['c3', 'c2'], commits);
  assert.deepEqual(r2, { base: 'c1', head: 'c3', contiguous: true });

  // Non-contiguous c3,c1: base=c0, head=c3, contiguous=false
  const r3 = computeDiffRange(['c3', 'c1'], commits);
  assert.equal(r3?.contiguous, false);
  assert.equal(r3?.head, 'c3');
  assert.equal(r3?.base, 'c0');

  // Root commit c0: base=empty tree hash
  const r4 = computeDiffRange(['c0'], commits);
  assert.equal(r4?.base, EMPTY_TREE_HASH);
  assert.equal(r4?.head, 'c0');

  // Empty selection
  assert.equal(computeDiffRange([], commits), null);
}

// ===== diffNavigation =====
{
  const files = [
    { path: 'a.ts', status: 'M' as const, insertions: 1, deletions: 0, binary: false },
    { path: 'b.ts', status: 'M' as const, insertions: 1, deletions: 0, binary: false },
    { path: 'c.ts', status: 'M' as const, insertions: 1, deletions: 0, binary: false },
  ];

  assert.deepEqual(
    getAdjacentFileChange(files, 'b.ts', 1)?.path,
    'c.ts'
  );
  assert.equal(getAdjacentFileChange(files, 'c.ts', 1)?.path, 'a.ts');
  assert.equal(getAdjacentFileChange(files, 'a.ts', -1)?.path, 'c.ts');
  assert.equal(getAdjacentFileChange(files, 'missing.ts', 1), undefined);
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
  assert.equal(relativeTime('2025-12-31T23:59:00Z', now), '1m ago (07:59)');
  assert.equal(relativeTime('2025-12-31T00:00:00Z', now), '1d ago (08:00)');
}

// ===== commitFilter =====
{
  const commits = [
    { hash: 'abc123def456', shortHash: 'abc123d', message: 'feat: add filter bar', author: 'Alice', email: '', date: '', parents: [] },
    { hash: 'def456abc789', shortHash: 'def456a', message: 'fix: search bug', author: 'Bob', email: '', date: '', parents: [] },
    { hash: '9990001112', shortHash: '9990001', message: 'FIX: capitalise', author: 'Carol', email: '', date: '', parents: [] },
  ];
  // Empty filter → all
  assert.equal(applySearch(commits).length, 3);
  assert.equal(applySearch(commits, {}).length, 3);
  assert.equal(applySearch(commits, { search: '   ' }).length, 3);

  // Substring match on message (case-insensitive by default)
  assert.deepEqual(
    applySearch(commits, { search: 'fix' }).map((c) => c.shortHash),
    ['def456a', '9990001']
  );

  // Cc case-sensitive
  assert.deepEqual(
    applySearch(commits, { search: 'fix', searchCaseSensitive: true }).map((c) => c.shortHash),
    ['def456a']
  );

  // Hash prefix match
  assert.deepEqual(
    applySearch(commits, { search: 'abc123' }).map((c) => c.shortHash),
    ['abc123d']
  );

  // Regex
  assert.deepEqual(
    applySearch(commits, { search: '^(feat|fix):', searchRegex: true }).map((c) => c.shortHash),
    ['abc123d', 'def456a', '9990001']
  );

  // Invalid regex → degrade to all
  assert.equal(applySearch(commits, { search: '(', searchRegex: true }).length, 3);
  assert.equal(isValidSearch('(', true), false);
  assert.equal(isValidSearch('(', false), true);
  assert.equal(isValidSearch('feat', true), true);
}

// ===== commitGraph =====
{
  const mk = (hash: string, parents: string[]) => ({
    hash, shortHash: hash, message: '', author: '', email: '', date: '', parents,
  });

  // Linear: all lane 0
  {
    const { rows, maxLanes } = layoutCommits([
      mk('c', ['b']), mk('b', ['a']), mk('a', []),
    ]);
    assert.equal(maxLanes, 1);
    assert.deepEqual(rows.map((r) => r.commitLane), [0, 0, 0]);
    // Middle commit should have one incoming edge + one outgoing edge
    assert.equal(rows[1]!.incomingEdges.length, 1);
    assert.equal(rows[1]!.outgoingEdges.length, 1);
    // Root commit has no parent -> no outgoing edge
    assert.equal(rows[2]!.outgoingEdges.length, 0);
    // Tip commit has no incoming edge
    assert.equal(rows[0]!.incomingEdges.length, 0);
  }

  // Fork + merge: main (c → a) and side (c → b → a), c is merge
  //   c
  //   |\
  //   | b
  //   |/
  //   a
  {
    const { rows, maxLanes } = layoutCommits([
      mk('c', ['a', 'b']),   // merge
      mk('b', ['a']),        // side branch tip
      mk('a', []),           // root
    ]);
    assert.equal(maxLanes, 2);
    assert.equal(rows[0]!.commitLane, 0);
    // Merge row has one outgoing edge for each parent.
    const rowCEdges = rows[0]!.outgoingEdges.map((e) => `${e.fromLane}->${e.toLane}`).sort();
    assert.deepEqual(rowCEdges, ['0->0', '0->1']);
    // b is on lane 1
    assert.equal(rows[1]!.commitLane, 1);
    assert.deepEqual(
      rows[1]!.passingEdges.map((e) => `${e.fromLane}->${e.toLane}`),
      ['0->0']
    );
    assert.deepEqual(
      rows[2]!.incomingEdges.map((e) => `${e.fromLane}->${e.toLane}`),
      ['0->0', '1->0']
    );
    assert.equal(rows[2]!.commitLane, 0);
  }

  // Truncated parent: only c, b provided, but b's parent a is not in the array
  {
    const { rows, maxLanes } = layoutCommits([
      mk('c', ['b']), mk('b', ['a']),
    ]);
    assert.equal(maxLanes, 1);
    // b's parent a is not in the list, don't draw edges that can't connect to visible commits
    assert.equal(rows[1]!.outgoingEdges.length, 0);
  }

  // Empty input
  {
    const { rows, maxLanes } = layoutCommits([]);
    assert.equal(rows.length, 0);
    assert.equal(maxLanes, 0);
  }
}

console.log('✅ all sanity checks passed');
