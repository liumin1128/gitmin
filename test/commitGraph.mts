/**
 * commitGraph 纯函数布局测试
 * 运行：node --experimental-strip-types test/commitGraph.mts
 */
import assert from 'node:assert/strict';
import { layoutCommits } from '../webview-ui/src/utils/commitGraph.ts';
import type { Commit } from '../shared/domain.ts';

function mk(hash: string, parents: string[]): Commit {
  return { hash, shortHash: hash, message: '', author: '', email: '', date: '', parents, refs: [] };
}

function laneOf(rows: { commitLane: number }[]): number[] {
  return rows.map((r) => r.commitLane);
}

// ===== 线性历史 =====
{
  const commits = [mk('c3', ['c2']), mk('c2', ['c1']), mk('c1', [])];
  const { rows, maxLanes } = layoutCommits(commits);
  assert.equal(maxLanes, 1);
  assert.deepEqual(laneOf(rows), [0, 0, 0]);
  for (const r of rows) {
    for (const e of r.topEdges) assert.equal(e.type, 'normal');
    for (const e of r.bottomEdges) assert.equal(e.type, 'normal');
  }
  assert.equal(rows[0]!.topEdges.length, 0);
  assert.equal(rows[2]!.bottomEdges.length, 0);
}

// ===== 分支 + merge =====
//   c3 (merge of c2, b2)
//   |\
//   | b2
//   |/
//   c2
{
  const commits = [mk('c3', ['c2', 'b2']), mk('b2', ['c2']), mk('c2', [])];
  const { rows, maxLanes } = layoutCommits(commits);
  assert.equal(maxLanes, 2);

  // c3 行：分支
  const c3Edges = rows[0]!.bottomEdges;
  assert.equal(c3Edges.length, 2);
  const branch = c3Edges.find((e) => e.type === 'branch')!;
  assert.ok(branch);
  assert.equal(branch.fromLane, rows[0]!.commitLane);

  // b2 行：merge
  const b2Edges = rows[1]!.bottomEdges;
  const merge = b2Edges.find((e) => e.type === 'merge')!;
  assert.ok(merge);
}

// ===== 父提交不可见时结束当前片段 =====
{
  const commits = [mk('c2', ['c1'])];
  const { rows } = layoutCommits(commits);
  assert.equal(rows[0]!.bottomEdges.length, 0,
    'missing parents must not produce a dangling edge');
}

// ===== 不可见的 merge parent 不应覆盖可见主线 =====
{
  const commits = [mk('merge', ['main', 'hidden-side']), mk('main', [])];
  const { rows } = layoutCommits(commits);
  assert.deepEqual(
    rows[0]!.bottomEdges.map((e) => `${e.type}:${e.fromLane}->${e.toLane}`),
    ['normal:0->0'],
    'only visible parent relationships should be rendered'
  );
}

// ===== 无关联历史（多个根，不同颜色，无连接） =====
{
  const commits = [mk('r2', ['r1']), mk('r1', []), mk('s1', [])];
  const { rows } = layoutCommits(commits);

  // r1 和 s1 是相邻行但无关，应有 null 安全
  assert.ok(rows[1]!.commitColor !== rows[2]!.commitColor,
    'unrelated roots should have different colors');
  // r1 无 bottomEdge（根），s1 无 topEdge（新根）
  assert.equal(rows[1]!.bottomEdges.length, 0);
  assert.equal(rows[2]!.topEdges.length, 0);
}

// ===== lane 回收 + 颜色不继承 =====
//   分支 A 结束后，新分支 B 复用 lane 应有新颜色
{
  const commits = [
    mk('merge', ['main', 'side']),
    mk('side', ['base']),
    mk('main', ['base']),
    mk('base', []),
    mk('other', ['prev']),
    mk('prev', []),
  ];
  const { rows } = layoutCommits(commits);

  // side 分支在 merge 后结束，其 lane 可回收
  // other 是另一条历史，不应继承 side 的颜色
  const others = rows.filter((r, i) => commits[i]!.hash === 'other');
  const sides = rows.filter((r, i) => commits[i]!.hash === 'side');
  assert.ok(sides.length > 0 && others.length > 0);
  assert.notEqual(sides[0]!.commitColor, others[0]!.commitColor);
}

// ===== octopus merge（3 个父提交） =====
{
  const commits = [mk('octo', ['a', 'b', 'c']), mk('c', []), mk('b', []), mk('a', [])];
  const { rows, maxLanes } = layoutCommits(commits);
  assert.equal(rows[0]!.bottomEdges.length, 3);
  assert.ok(maxLanes >= 3);
}

// ===== 过滤后断层（中间 commit 被过滤，不连线） =====
//   c5 → c4 → [c3 过滤] → c2 → c1
{
  const commits = [mk('c5', ['c4']), mk('c4', ['c3']), mk('c2', ['c1']), mk('c1', [])];
  const { rows } = layoutCommits(commits);

  // c4 的 parent c3 不在列表中，因此该颜色片段在 c4 结束
  const c4Row = rows[1]!;
  assert.equal(c4Row.bottomEdges.length, 0);

  // c2 不应从 c4 连线，因为没有等待 c2 的 lane
  const c2Row = rows[2]!;
  assert.equal(c2Row.topEdges.length, 0, 'c2 should not connect to filtered c4 row');
}

// ===== 颜色稳定性（相同输入 → 相同颜色） =====
{
  const commits = [mk('f', ['e']), mk('e', ['d']), mk('d', [])];
  const r1 = layoutCommits(commits);
  const r2 = layoutCommits(commits);
  for (let i = 0; i < r1.rows.length; i++) {
    assert.equal(r1.rows[i]!.commitColor, r2.rows[i]!.commitColor);
    assert.deepEqual(r1.rows[i]!.bottomEdges.map((e) => e.color),
      r2.rows[i]!.bottomEdges.map((e) => e.color));
  }
}

// ===== 空输入 =====
{
  const { rows, maxLanes } = layoutCommits([]);
  assert.equal(rows.length, 0);
  assert.equal(maxLanes, 0);
}

console.log('✅ commitGraph layout tests passed');
