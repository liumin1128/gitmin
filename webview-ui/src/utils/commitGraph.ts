/**
 * commit DAG 布局：贪心 lane 分配（参考 gitk）
 * 输入按时间倒序（最新在前）；输出每行 lane / edges，供 SVG 渲染
 * 纯函数，无副作用
 */
import type { Commit } from '../../../shared/domain';

export interface GraphEdge {
  fromLane: number;
  toLane: number;
  color: number;
}

export interface GraphRow {
  /** 圆点所在 lane 列 */
  commitLane: number;
  /** 圆点颜色 id（对应 lane 首次出现时分配） */
  commitColor: number;
  /** 顶边 → 圆点中心 之间的线段 */
  topEdges: GraphEdge[];
  /** 圆点中心 → 底边 之间的线段 */
  bottomEdges: GraphEdge[];
  /** 本行涉及的最大 lane 数（含穿过） */
  laneCount: number;
}

export interface GraphLayout {
  rows: GraphRow[];
  maxLanes: number;
}

/**
 * 主入口
 */
export function layoutCommits(commits: Commit[]): GraphLayout {
  const activeLanes: (string | null)[] = [];
  const laneColors: (number | null)[] = [];
  const rows: GraphRow[] = [];
  let nextColorId = 0;
  let maxLanes = 0;

  for (const commit of commits) {
    const before = activeLanes.slice();
    const beforeColors = laneColors.slice();

    // 1. 找出等待此 commit 的所有 lane
    const waiting: number[] = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] === commit.hash) waiting.push(i);
    }

    // 2. 决定 commit lane（最左等待位；否则复用最左 null 位；否则追加）
    let commitLane: number;
    if (waiting.length > 0) {
      commitLane = waiting[0]!;
      // 其他等待 lane 合流后释放
      for (let k = 1; k < waiting.length; k++) {
        activeLanes[waiting[k]!] = null;
        laneColors[waiting[k]!] = null;
      }
    } else {
      commitLane = findFirstEmpty(activeLanes);
      if (commitLane === activeLanes.length) {
        activeLanes.push(null);
        laneColors.push(null);
      }
      laneColors[commitLane] = nextColorId++;
    }
    const commitColor = laneColors[commitLane]!;

    // 3. 本 lane 更新为 parent[0]
    const p0 = commit.parents[0];
    if (p0) {
      activeLanes[commitLane] = p0;
    } else {
      activeLanes[commitLane] = null;
      laneColors[commitLane] = null;
    }

    // 4. 额外 parents（merge）：已在则复用，否则占空位/追加
    for (let k = 1; k < commit.parents.length; k++) {
      const p = commit.parents[k]!;
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
    const extraParents = new Set(commit.parents.slice(1));

    // 5. topEdges：before 每个非空 lane → 圆点中心
    const topEdges: GraphEdge[] = [];
    for (let i = 0; i < before.length; i++) {
      const v = before[i];
      if (v === null) continue;
      const color = beforeColors[i]!;
      if (v === commit.hash) {
        // 等待此 commit：合流到圆点
        topEdges.push({ fromLane: i, toLane: commitLane, color });
      } else {
        // 穿过：垂直直线
        topEdges.push({ fromLane: i, toLane: i, color });
      }
    }

    // 6. bottomEdges：圆点中心 → after 每个非空 lane
    const bottomEdges: GraphEdge[] = [];
    for (let j = 0; j < after.length; j++) {
      const v = after[j];
      if (v === null) continue;
      const color = afterColors[j]!;
      if (j === commitLane) {
        // parent[0] 从圆点直下（或斜出到 lane，但 j == commitLane 时就是直下）
        bottomEdges.push({ fromLane: commitLane, toLane: j, color });
      } else if (extraParents.has(v)) {
        // 额外 parent：圆点斜出
        bottomEdges.push({ fromLane: commitLane, toLane: j, color });
      } else {
        // 穿过：垂直直线
        bottomEdges.push({ fromLane: j, toLane: j, color });
      }
    }

    const laneCount = Math.max(trimmedLength(activeLanes, before), commitLane + 1);
    rows.push({ commitLane, commitColor, topEdges, bottomEdges, laneCount });
    if (laneCount > maxLanes) maxLanes = laneCount;
  }

  return { rows, maxLanes };
}

/** 找到最左边的 null 位；若无则返回 length（表示"追加"） */
function findFirstEmpty(lanes: (string | null)[]): number {
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i] === null) return i;
  }
  return lanes.length;
}

/** 计算本行有意义的 lane 数：before/after 两个快照中最高非空索引 + 1 */
function trimmedLength(after: (string | null)[], before: (string | null)[]): number {
  let n = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] !== null) {
      n = i + 1;
      break;
    }
  }
  for (let i = after.length - 1; i >= 0; i--) {
    if (after[i] !== null) {
      if (i + 1 > n) n = i + 1;
      break;
    }
  }
  return n;
}
