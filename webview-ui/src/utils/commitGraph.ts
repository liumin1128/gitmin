/**
 * Commit DAG layout: greedy lane assignment + color inheritance
 * - First parent inherits current lane color
 * - Other parents create independent color lanes
 * - Unrelated histories use different colors and stay disconnected
 * - Only draws parent-child relationships visible in the current list
 * Pure function, no side effects
 */
import type { Commit } from '../../../shared/domain';

export type EdgeType = 'normal' | 'branch' | 'merge';

export interface GraphEdge {
  fromLane: number;
  toLane: number;
  color: number;
  type: EdgeType;
}

export interface GraphRow {
  commitLane: number;
  commitColor: number;
  topEdges: GraphEdge[];
  bottomEdges: GraphEdge[];
  laneCount: number;
}

export interface GraphLayout {
  rows: GraphRow[];
  maxLanes: number;
}

export function layoutCommits(commits: Commit[]): GraphLayout {
  const visibleHashes = new Set(commits.map((c) => c.hash));
  const activeLanes: (string | null)[] = [];
  const laneColors: (number | null)[] = [];
  const rows: GraphRow[] = [];
  let nextColorId = 0;
  let maxLanes = 0;

  for (const commit of commits) {
    const before = activeLanes.slice();
    const beforeColors = laneColors.slice();

    const waiting: number[] = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] === commit.hash) waiting.push(i);
    }

    let commitLane: number;
    if (waiting.length > 0) {
      commitLane = waiting[0]!;
    } else {
      commitLane = findFirstEmpty(activeLanes);
      if (commitLane === activeLanes.length) {
        activeLanes.push(null);
        laneColors.push(null);
      }
      laneColors[commitLane] = nextColorId++;
    }
    const commitColor = laneColors[commitLane]!;

    const p0 = commit.parents[0] ?? null;
    let mergeTargetLane: number | null = null;

    if (p0 && visibleHashes.has(p0)) {
      const existingLane = activeLanes.indexOf(p0);
      if (existingLane >= 0 && existingLane !== commitLane) {
        mergeTargetLane = existingLane;
        activeLanes[commitLane] = null;
        laneColors[commitLane] = null;
      } else {
        activeLanes[commitLane] = p0;
      }
    } else {
      activeLanes[commitLane] = null;
      laneColors[commitLane] = null;
    }

    for (let k = 1; k < commit.parents.length; k++) {
      const p = commit.parents[k]!;
      if (!visibleHashes.has(p)) continue;
      const existing = activeLanes.indexOf(p);
      if (existing >= 0) continue;
      const target = findFirstEmpty(activeLanes);
      if (target === activeLanes.length) {
        activeLanes.push(p);
        laneColors.push(nextColorId++);
      } else {
        activeLanes[target] = p;
        laneColors[target] = nextColorId++;
      }
    }

    const after = activeLanes.slice();
    const afterColors = laneColors.slice();

    const topEdges: GraphEdge[] = [];
    for (let i = 0; i < before.length; i++) {
      const v = before[i];
      if (v === null) continue;
      const color = beforeColors[i]!;
      if (v === commit.hash) {
        topEdges.push({ fromLane: i, toLane: commitLane, color, type: 'normal' });
      } else {
        topEdges.push({ fromLane: i, toLane: i, color, type: 'normal' });
      }
    }

    const bottomEdges: GraphEdge[] = [];
    const handledLanes = new Set<number>();

    if (p0 && visibleHashes.has(p0) && mergeTargetLane === null) {
      bottomEdges.push({
        fromLane: commitLane,
        toLane: commitLane,
        color: commitColor,
        type: 'normal',
      });
      handledLanes.add(commitLane);
    }

    if (mergeTargetLane !== null) {
      bottomEdges.push({
        fromLane: commitLane,
        toLane: mergeTargetLane,
        color: commitColor,
        type: 'merge',
      });
      handledLanes.add(commitLane);
    }

    for (let k = 1; k < commit.parents.length; k++) {
      const p = commit.parents[k]!;
      const targetLane = after.indexOf(p);
      if (targetLane >= 0 && !handledLanes.has(targetLane)) {
        bottomEdges.push({
          fromLane: commitLane,
          toLane: targetLane,
          color: afterColors[targetLane]!,
          type: 'branch',
        });
        handledLanes.add(targetLane);
      }
    }

    for (let j = 0; j < after.length; j++) {
      if (after[j] === null || handledLanes.has(j)) continue;
      bottomEdges.push({
        fromLane: j,
        toLane: j,
        color: afterColors[j]!,
        type: 'normal',
      });
    }

    const laneCount = Math.max(trimmedLength(after, before), commitLane + 1);
    rows.push({ commitLane, commitColor, topEdges, bottomEdges, laneCount });
    if (laneCount > maxLanes) maxLanes = laneCount;
  }

  return { rows, maxLanes };
}

function findFirstEmpty(lanes: (string | null)[]): number {
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i] === null) return i;
  }
  return lanes.length;
}

function trimmedLength(after: (string | null)[], before: (string | null)[]): number {
  let n = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] !== null) { n = i + 1; break; }
  }
  for (let i = after.length - 1; i >= 0; i--) {
    if (after[i] !== null) { if (i + 1 > n) n = i + 1; break; }
  }
  return n;
}
