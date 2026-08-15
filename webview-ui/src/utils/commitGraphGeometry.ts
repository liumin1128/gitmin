export const COMMIT_GRAPH_LANE_WIDTH = 11;
export const COMMIT_GRAPH_ROW_HEIGHT = 22;

export function commitGraphLaneX(lane: number): number {
  return (lane + 1) * COMMIT_GRAPH_LANE_WIDTH;
}

export function commitGraphWidth(laneCount: number): number {
  return (Math.max(laneCount, 1) + 1) * COMMIT_GRAPH_LANE_WIDTH;
}
