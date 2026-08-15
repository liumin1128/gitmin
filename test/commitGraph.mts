/**
 * Commit graph pure layout tests.
 * Run: node --experimental-strip-types test/commitGraph.mts
 */
import assert from 'node:assert/strict';
import {
  layoutCommits,
  shouldPreserveUnresolvedParents,
} from '../webview-ui/src/utils/commitGraph.ts';
import type { Commit } from '../shared/domain.ts';

function mk(hash: string, parents: string[], refs: string[] = []): Commit {
  return {
    hash,
    shortHash: hash,
    message: '',
    author: '',
    email: '',
    date: '',
    parents,
    refs,
    isUnpushed: false,
  };
}

function laneOf(rows: { commitLane: number }[]): number[] {
  return rows.map((row) => row.commitLane);
}

function edges(edges: { fromLane: number; toLane: number }[]): string[] {
  return edges.map((edge) => `${edge.fromLane}->${edge.toLane}`);
}

function boundaryEndpoints(
  graphEdges: { fromLane: number; toLane: number; color: number | string }[],
  endpoint: 'fromLane' | 'toLane'
): string[] {
  return graphEdges
    .map((edge) => `${edge[endpoint]}:${edge.color}`)
    .sort();
}

// HEAD gets the dedicated current-ref color and marker, inherited by its lane.
{
  const { rows } = layoutCommits([
    mk('head', ['parent'], ['HEAD -> main']),
    mk('parent', []),
  ]);

  assert.equal(rows[0]!.nodeKind, 'head');
  assert.equal(rows[0]!.commitColor, 'current');
  assert.equal(rows[1]!.commitColor, 'current');
}

// Linear history stays in one lane.
{
  const commits = [mk('c3', ['c2']), mk('c2', ['c1']), mk('c1', [])];
  const { rows, maxLanes } = layoutCommits(commits);

  assert.equal(maxLanes, 1);
  assert.deepEqual(laneOf(rows), [0, 0, 0]);
  assert.deepEqual(edges(rows[0]!.incomingEdges), []);
  assert.deepEqual(edges(rows[0]!.outgoingEdges), ['0->0']);
  assert.deepEqual(edges(rows[1]!.incomingEdges), ['0->0']);
  assert.deepEqual(edges(rows[1]!.outgoingEdges), ['0->0']);
  assert.deepEqual(edges(rows[2]!.outgoingEdges), []);
}

// Merge parents occupy separate lanes and converge at their shared parent.
//   c3
//   |\
//   | b2
//   |/
//   c2
{
  const commits = [mk('c3', ['c2', 'b2']), mk('b2', ['c2']), mk('c2', [])];
  const { rows, maxLanes } = layoutCommits(commits);

  assert.equal(maxLanes, 2);
  assert.deepEqual(edges(rows[0]!.outgoingEdges), ['0->0', '0->1']);
  assert.equal(rows[1]!.commitLane, 1);
  assert.deepEqual(edges(rows[1]!.passingEdges), ['0->0']);
  assert.deepEqual(edges(rows[1]!.incomingEdges), ['1->1']);
  assert.deepEqual(edges(rows[1]!.outgoingEdges), ['1->1']);
  assert.equal(rows[1]!.incomingEdges[0]!.color, rows[1]!.commitColor);
  assert.equal(rows[1]!.outgoingEdges[0]!.color, rows[1]!.commitColor);
  assert.deepEqual(edges(rows[2]!.incomingEdges), ['0->0', '1->0']);
}

// Closing a lane compacts every lane to its right instead of leaving holes.
{
  const commits = [mk('head', ['side', 'main']), mk('side', []), mk('main', [])];
  const { rows } = layoutCommits(commits);

  assert.deepEqual(edges(rows[1]!.passingEdges), ['1->0']);
  assert.equal(rows[2]!.commitLane, 0);
}

// A parent already active in another lane remains separate until its node row.
{
  const commits = [
    mk('head', ['shared']),
    mk('merge', ['main', 'shared']),
    mk('shared', []),
    mk('main', []),
  ];
  const { rows } = layoutCommits(commits);

  assert.deepEqual(edges(rows[1]!.passingEdges), ['0->0']);
  assert.deepEqual(edges(rows[1]!.outgoingEdges), ['1->1', '1->2']);
  assert.deepEqual(edges(rows[2]!.incomingEdges), ['0->0', '2->0']);
  assert.deepEqual(edges(rows[2]!.passingEdges), ['1->0']);
}

// Missing parents end the visible segment.
{
  const { rows } = layoutCommits([mk('c2', ['c1'])]);
  assert.deepEqual(rows[0]!.outgoingEdges, []);
}

// Parents beyond an unfiltered page stay open through the page boundary.
{
  const commits = [mk('merge', ['main-next', 'side']), mk('side', [])];
  const { rows } = layoutCommits(commits, { preserveUnresolvedParents: true });

  assert.deepEqual(edges(rows[0]!.outgoingEdges), ['0->0', '0->1']);
  assert.deepEqual(edges(rows[1]!.passingEdges), ['0->0']);
}

// Filtering creates real gaps, so unresolved parents are only preserved for
// an unfiltered paginated list.
{
  assert.equal(shouldPreserveUnresolvedParents(true, {}), true);
  assert.equal(shouldPreserveUnresolvedParents(true, { branch: '__all__' }), true);
  assert.equal(shouldPreserveUnresolvedParents(false, {}), false);
  assert.equal(shouldPreserveUnresolvedParents(true, { search: 'fix' }), false);
  assert.equal(shouldPreserveUnresolvedParents(true, { author: 'Ada' }), false);
  assert.equal(shouldPreserveUnresolvedParents(true, { dateAfter: '2026-01-01' }), false);
  assert.equal(shouldPreserveUnresolvedParents(true, { dateBefore: '2026-12-31' }), false);
}

// Invisible merge parents do not create phantom lanes.
{
  const commits = [mk('merge', ['main', 'hidden-side']), mk('main', [])];
  const { rows, maxLanes } = layoutCommits(commits);

  assert.equal(maxLanes, 1);
  assert.deepEqual(edges(rows[0]!.outgoingEdges), ['0->0']);
}

// Adjacent unrelated roots stay disconnected and receive independent colors.
{
  const commits = [mk('r2', ['r1']), mk('r1', []), mk('s1', [])];
  const { rows } = layoutCommits(commits);

  assert.notEqual(rows[1]!.commitColor, rows[2]!.commitColor);
  assert.deepEqual(rows[1]!.outgoingEdges, []);
  assert.deepEqual(rows[2]!.incomingEdges, []);
}

// A later history can reuse a lane position without inheriting its color.
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

  assert.notEqual(rows[1]!.commitColor, rows[4]!.commitColor);
}

// Octopus merges allocate one output edge per parent.
{
  const commits = [mk('octo', ['a', 'b', 'c']), mk('c', []), mk('b', []), mk('a', [])];
  const { rows, maxLanes } = layoutCommits(commits);

  assert.equal(rows[0]!.outgoingEdges.length, 3);
  assert.equal(rows[0]!.nodeKind, 'merge');
  assert.equal(maxLanes, 3);
}

// A filtered middle commit splits the graph into disconnected segments.
{
  const commits = [mk('c5', ['c4']), mk('c4', ['c3']), mk('c2', ['c1']), mk('c1', [])];
  const { rows } = layoutCommits(commits);

  assert.deepEqual(rows[1]!.outgoingEdges, []);
  assert.deepEqual(rows[2]!.incomingEdges, []);
}

// Layout and colors are deterministic.
{
  const commits = [mk('f', ['e']), mk('e', ['d']), mk('d', [])];
  assert.deepEqual(layoutCommits(commits), layoutCommits(commits));
}

// Every lane crossing a row boundary has exactly one matching segment on the
// next row, including its color.
{
  const commits = [
    mk('m2', ['left', 'right']),
    mk('right', ['base']),
    mk('left', ['base']),
    mk('base', ['root']),
    mk('root', []),
  ];
  const { rows } = layoutCommits(commits);

  for (let index = 0; index < rows.length - 1; index++) {
    const current = rows[index]!;
    const next = rows[index + 1]!;
    assert.deepEqual(
      boundaryEndpoints(
        [...current.passingEdges, ...current.outgoingEdges],
        'toLane'
      ),
      boundaryEndpoints(
        [...next.passingEdges, ...next.incomingEdges],
        'fromLane'
      )
    );
  }
}

{
  assert.deepEqual(layoutCommits([]), { rows: [], maxLanes: 0 });
}

console.log('commit graph layout tests passed');
