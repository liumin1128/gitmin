/**
 * Compact swimlane layout for a topologically ordered commit list.
 *
 * The state transition model is adapted from VS Code's SCM history graph:
 * https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/scm/browser/scmHistory.ts
 * See THIRD_PARTY_NOTICES.md for its MIT license notice.
 */
import type { Commit, CommitFilters } from '../../../shared/domain';

export type GraphColor = number | 'current';
export type GraphNodeKind = 'node' | 'merge' | 'head';

export interface GraphEdge {
  fromLane: number;
  toLane: number;
  color: GraphColor;
}

export interface GraphRow {
  commitLane: number;
  commitColor: GraphColor;
  nodeKind: GraphNodeKind;
  incomingEdges: GraphEdge[];
  outgoingEdges: GraphEdge[];
  passingEdges: GraphEdge[];
  laneCount: number;
}

export interface GraphLayout {
  rows: GraphRow[];
  maxLanes: number;
}

export interface GraphLayoutOptions {
  preserveUnresolvedParents?: boolean;
}

interface ActiveLane {
  key: number;
  target: string;
  color: GraphColor;
}

export function shouldPreserveUnresolvedParents(
  hasMore: boolean,
  filters: CommitFilters
): boolean {
  if (!hasMore) return false;
  return ![
    filters.search,
    filters.author,
    filters.dateAfter,
    filters.dateBefore,
  ].some((value) => value?.trim());
}

export function layoutCommits(
  commits: Commit[],
  options: GraphLayoutOptions = {}
): GraphLayout {
  const visibleHashes = new Set(commits.map((commit) => commit.hash));
  const preserveUnresolvedParents = options.preserveUnresolvedParents === true;
  const rows: GraphRow[] = [];
  let activeLanes: ActiveLane[] = [];
  let nextLaneKey = 0;
  let nextColor = 0;
  let maxLanes = 0;

  const createLane = (target: string, color: GraphColor): ActiveLane => ({
    key: nextLaneKey++,
    target,
    color,
  });

  for (const commit of commits) {
    const parents = commit.parents.filter(
      (parent) => visibleHashes.has(parent) || preserveUnresolvedParents
    );
    const inputLanes = activeLanes;
    const incomingLaneIndexes = findTargetLanes(inputLanes, commit.hash);
    const commitLane = incomingLaneIndexes[0] ?? inputLanes.length;
    const commitColor = incomingLaneIndexes.length > 0
      ? inputLanes[commitLane]!.color
      : isHeadCommit(commit)
        ? 'current'
        : nextColor++;

    const outputLanes: ActiveLane[] = [];
    const parentLanes: ActiveLane[] = [];
    let firstParentAdded = false;

    for (const lane of inputLanes) {
      if (lane.target !== commit.hash) {
        outputLanes.push(lane);
        continue;
      }

      if (!firstParentAdded && parents[0]) {
        const firstParentLane = createLane(parents[0], commitColor);
        outputLanes.push(firstParentLane);
        parentLanes.push(firstParentLane);
        firstParentAdded = true;
      }
    }

    if (!firstParentAdded && parents[0]) {
      const firstParentLane = createLane(parents[0], commitColor);
      outputLanes.push(firstParentLane);
      parentLanes.push(firstParentLane);
    }

    for (let index = 1; index < parents.length; index++) {
      const parentLane = createLane(parents[index]!, nextColor++);
      outputLanes.push(parentLane);
      parentLanes.push(parentLane);
    }

    const outputLaneByKey = new Map(
      outputLanes.map((lane, index) => [lane.key, index] as const)
    );
    const passingEdges = inputLanes.flatMap((lane, fromLane) => {
      if (lane.target === commit.hash) return [];
      const toLane = outputLaneByKey.get(lane.key);
      return toLane === undefined
        ? []
        : [{ fromLane, toLane, color: lane.color }];
    });
    const incomingEdges = incomingLaneIndexes.map((fromLane) => ({
      fromLane,
      toLane: commitLane,
      color: inputLanes[fromLane]!.color,
    }));
    const outgoingEdges = parentLanes.map((lane) => ({
      fromLane: commitLane,
      toLane: outputLaneByKey.get(lane.key)!,
      color: lane.color,
    }));

    const laneCount = Math.max(
      inputLanes.length,
      outputLanes.length,
      commitLane + 1
    );
    rows.push({
      commitLane,
      commitColor,
      nodeKind: isHeadCommit(commit)
        ? 'head'
        : commit.parents.length > 1
          ? 'merge'
          : 'node',
      incomingEdges,
      outgoingEdges,
      passingEdges,
      laneCount,
    });
    maxLanes = Math.max(maxLanes, laneCount);
    activeLanes = outputLanes;
  }

  return { rows, maxLanes };
}

function findTargetLanes(lanes: ActiveLane[], target: string): number[] {
  const indexes: number[] = [];
  for (let index = 0; index < lanes.length; index++) {
    if (lanes[index]!.target === target) indexes.push(index);
  }
  return indexes;
}

function isHeadCommit(commit: Commit): boolean {
  return (commit.refs ?? []).some(
    (ref) => ref === 'HEAD' || ref.startsWith('HEAD -> ')
  );
}
