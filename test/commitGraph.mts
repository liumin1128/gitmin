/**
 * commitGraph pure function layout tests
 * Run: node --experimental-strip-types test/commitGraph.mts
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

// ===== Linear history =====
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

// ===== Branch + merge =====
//   c3 (merge of c2, b2)
//   |\
//   | b2
//   |/
//   c2
{
  const commits = [mk('c3', ['c2', 'b2']), mk('b2', ['c2']), mk('c2', [])];
  const { rows, maxLanes } = layoutCommits(commits);
  assert.equal(maxLanes, 2);

  // c3 row: branch
  const c3Edges = rows[0]!.bottomEdges;
  assert.equal(c3Edges.length, 2);
  const branch = c3Edges.find((e) => e.type === 'branch')!;
  assert.ok(branch);
  assert.equal(branch.fromLane, rows[0]!.commitLane);

  // b2 row: merge
  const b2Edges = rows[1]!.bottomEdges;
  const merge = b2Edges.find((e) => e.type === 'merge')!;
  assert.ok(merge);

  // color continuity: merge diagonal carries the side-branch color
  // (matches b2's dot + incoming top edge), not the mainline target color
  assert.equal(merge.color, rows[1]!.commitColor,
    'merge edge must use the side-branch (commit) color for continuity');
  const b2TopInto = rows[1]!.topEdges.find((e) => e.toLane === rows[1]!.commitLane)!;
  assert.equal(b2TopInto.color, rows[1]!.commitColor,
    'incoming top edge shares the side-branch color');
}

// ===== Parent not visible → end current segment =====
{
  const commits = [mk('c2', ['c1'])];
  const { rows } = layoutCommits(commits);
  assert.equal(rows[0]!.bottomEdges.length, 0,
    'missing parents must not produce a dangling edge');
}

// ===== Invisible merge parent should not override visible mainline =====
{
  const commits = [mk('merge', ['main', 'hidden-side']), mk('main', [])];
  const { rows } = layoutCommits(commits);
  assert.deepEqual(
    rows[0]!.bottomEdges.map((e) => `${e.type}:${e.fromLane}->${e.toLane}`),
    ['normal:0->0'],
    'only visible parent relationships should be rendered'
  );
}

// ===== Unrelated histories (multiple roots, different colors, no connection) =====
{
  const commits = [mk('r2', ['r1']), mk('r1', []), mk('s1', [])];
  const { rows } = layoutCommits(commits);

  // r1 and s1 are adjacent but unrelated, should be null-safe
  assert.ok(rows[1]!.commitColor !== rows[2]!.commitColor,
    'unrelated roots should have different colors');
  // r1 has no bottomEdge (root), s1 has no topEdge (new root)
  assert.equal(rows[1]!.bottomEdges.length, 0);
  assert.equal(rows[2]!.topEdges.length, 0);
}

// ===== Lane recycling + no color inheritance =====
//   After branch A ends, new branch B reuses lane but gets a new color
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

  // side branch ends after merge, its lane can be recycled
  // other is a different history, should not inherit side's color
  const others = rows.filter((r, i) => commits[i]!.hash === 'other');
  const sides = rows.filter((r, i) => commits[i]!.hash === 'side');
  assert.ok(sides.length > 0 && others.length > 0);
  assert.notEqual(sides[0]!.commitColor, others[0]!.commitColor);
}

// ===== Octopus merge (3 parents) =====
{
  const commits = [mk('octo', ['a', 'b', 'c']), mk('c', []), mk('b', []), mk('a', [])];
  const { rows, maxLanes } = layoutCommits(commits);
  assert.equal(rows[0]!.bottomEdges.length, 3);
  assert.ok(maxLanes >= 3);
}

// ===== Filtered gap (middle commit filtered, no connection) =====
//   c5 → c4 → [c3 filtered] → c2 → c1
{
  const commits = [mk('c5', ['c4']), mk('c4', ['c3']), mk('c2', ['c1']), mk('c1', [])];
  const { rows } = layoutCommits(commits);

  // c4's parent c3 is not in the list, so this color segment ends at c4
  const c4Row = rows[1]!;
  assert.equal(c4Row.bottomEdges.length, 0);

  // c2 should not connect from c4, because there is no lane waiting for c2
  const c2Row = rows[2]!;
  assert.equal(c2Row.topEdges.length, 0, 'c2 should not connect to filtered c4 row');
}

// ===== Color stability (same input → same colors) =====
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

// ===== Empty input =====
{
  const { rows, maxLanes } = layoutCommits([]);
  assert.equal(rows.length, 0);
  assert.equal(maxLanes, 0);
}

console.log('✅ commitGraph layout tests passed');
