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
import { applySearch, isValidSearch } from '../shared/commitFilter.ts';
import { layoutCommits } from '../webview-ui/src/utils/commitGraph.ts';

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

// ===== commitFilter =====
{
  const commits = [
    { hash: 'abc123def456', shortHash: 'abc123d', message: 'feat: add filter bar', author: 'Alice', email: '', date: '', parents: [] },
    { hash: 'def456abc789', shortHash: 'def456a', message: 'fix: search bug', author: 'Bob', email: '', date: '', parents: [] },
    { hash: '9990001112', shortHash: '9990001', message: 'FIX: capitalise', author: 'Carol', email: '', date: '', parents: [] },
  ];
  // 空 filter → 全部
  assert.equal(applySearch(commits).length, 3);
  assert.equal(applySearch(commits, {}).length, 3);
  assert.equal(applySearch(commits, { search: '   ' }).length, 3);

  // 子串匹配 message（默认忽略大小写）
  assert.deepEqual(
    applySearch(commits, { search: 'fix' }).map((c) => c.shortHash),
    ['def456a', '9990001']
  );

  // Cc 大小写敏感
  assert.deepEqual(
    applySearch(commits, { search: 'fix', searchCaseSensitive: true }).map((c) => c.shortHash),
    ['def456a']
  );

  // hash 前缀命中
  assert.deepEqual(
    applySearch(commits, { search: 'abc123' }).map((c) => c.shortHash),
    ['abc123d']
  );

  // 正则
  assert.deepEqual(
    applySearch(commits, { search: '^(feat|fix):', searchRegex: true }).map((c) => c.shortHash),
    ['abc123d', 'def456a', '9990001']
  );

  // 非法正则 → 退化为全部
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

  // 线性：全部 lane 0
  {
    const { rows, maxLanes } = layoutCommits([
      mk('c', ['b']), mk('b', ['a']), mk('a', []),
    ]);
    assert.equal(maxLanes, 1);
    assert.deepEqual(rows.map((r) => r.commitLane), [0, 0, 0]);
    // 中间 commit 应有一条上边线 + 一条下边线
    assert.equal(rows[1]!.topEdges.length, 1);
    assert.equal(rows[1]!.bottomEdges.length, 1);
    // 根 commit 无 parent → 无下边线
    assert.equal(rows[2]!.bottomEdges.length, 0);
    // 尖端 commit 无上边线（activeLanes 之前是空）
    assert.equal(rows[0]!.topEdges.length, 0);
  }

  // 分叉 + merge：main（c → a）与 side（c → b → a），c 是 merge
  //   c
  //   |\
  //   | b
  //   |/
  //   a
  {
    const { rows, maxLanes } = layoutCommits([
      mk('c', ['a', 'b']),   // merge
      mk('b', ['a']),        // side branch tip
      mk('a', []),           // 根
    ]);
    assert.equal(maxLanes, 2);
    assert.equal(rows[0]!.commitLane, 0);
    // merge 行 bottomEdges 应含 lane 0 → 0 和 0 → 1（斜出到 side）
    const rowCEdges = rows[0]!.bottomEdges.map((e) => `${e.fromLane}->${e.toLane}`).sort();
    assert.deepEqual(rowCEdges, ['0->0', '0->1']);
    // b 位于 lane 1
    assert.equal(rows[1]!.commitLane, 1);
    // b 合流到 a：a 已经在 lane 0 上，所以 b 的 parent[0]=a 复用 lane 0；
    // 这里 lane 1 应该在 b 之后消失（after=[a, null]）
    // b 行 bottomEdges 应含 lane 0 直下（a 穿过） 但不含 lane 1 出
    // a 位于 lane 0
    assert.equal(rows[2]!.commitLane, 0);
  }

  // 截断 parent：只提供 c, b，但 b 的 parent a 不在数组
  {
    const { rows, maxLanes } = layoutCommits([
      mk('c', ['b']), mk('b', ['a']),
    ]);
    assert.equal(maxLanes, 1);
    // b 行有 bottomEdge（期待 a 出去），即使 a 不在列表
    assert.equal(rows[1]!.bottomEdges.length, 1);
  }

  // 空输入
  {
    const { rows, maxLanes } = layoutCommits([]);
    assert.equal(rows.length, 0);
    assert.equal(maxLanes, 0);
  }
}

console.log('✅ all sanity checks passed');
