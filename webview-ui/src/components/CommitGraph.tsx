/**
 * commit graph 单行 SVG 渲染
 * - 同 lane 边：垂直实线
 * - 跨 lane 边（branch/merge）：折线路径
 * - 历史片段首尾节点绘制竖向短端帽
 */
import type { GraphRow, GraphEdge } from '../utils/commitGraph';

const LANE_W = 16;
const ROW_H = 22;
const DOT_R = 3;
const STROKE_W = 1.5;
const STEP_H = 5;
const END_CAP_H = 8;

interface Props {
  row: GraphRow;
  maxLanes: number;
}

export function CommitGraph({ row, maxLanes }: Props) {
  const width = maxLanes * LANE_W;
  const height = ROW_H;
  const midY = height / 2;
  const commitX = laneX(row.commitLane);
  const commitColor = laneColor(row.commitColor);
  const hasTopConnection = row.topEdges.some((edge) => edge.toLane === row.commitLane);
  const hasBottomConnection = row.bottomEdges.some((edge) => edge.fromLane === row.commitLane);

  return (
    <svg className="commit-graph" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {row.topEdges.map((e, i) => (
        <EdgePath key={`t${i}`} edge={e} yStart={0} yEnd={midY} />
      ))}
      {row.bottomEdges.map((e, i) => (
        <EdgePath key={`b${i}`} edge={e} yStart={midY} yEnd={height} />
      ))}
      {!hasTopConnection && (
        <line
          x1={commitX}
          y1={midY - END_CAP_H}
          x2={commitX}
          y2={midY}
          style={{ stroke: commitColor, strokeWidth: STROKE_W }}
        />
      )}
      {!hasBottomConnection && (
        <line
          x1={commitX}
          y1={midY}
          x2={commitX}
          y2={midY + END_CAP_H}
          style={{ stroke: commitColor, strokeWidth: STROKE_W }}
        />
      )}
      <circle
        cx={commitX}
        cy={midY}
        r={DOT_R}
        style={{ fill: commitColor }}
      />
    </svg>
  );
}

function EdgePath({ edge, yStart, yEnd }: { edge: GraphEdge; yStart: number; yEnd: number }) {
  const x1 = laneX(edge.fromLane);
  const x2 = laneX(edge.toLane);
  const color = laneColor(edge.color);
  const sameLane = edge.fromLane === edge.toLane;

  if (sameLane) {
    return (
      <line
        x1={x1} y1={yStart} x2={x2} y2={yEnd}
        style={{
          stroke: color,
          strokeWidth: STROKE_W,
        }}
      />
    );
  }

  const midY = (yStart + yEnd) / 2;
  const stepY = yStart + STEP_H;

  const d = [
    `M ${x1} ${yStart}`,
    `L ${x1} ${stepY}`,
    `L ${x2} ${midY}`,
    `L ${x2} ${yEnd}`,
  ].join(' ');

  return (
    <path
      d={d}
      fill="none"
      style={{
        stroke: color,
        strokeWidth: STROKE_W,
      }}
    />
  );
}

function laneX(lane: number): number {
  return lane * LANE_W + LANE_W / 2;
}

const PALETTE: string[] = [
  '#89d185',
  '#4f83cc',
  '#b180d7',
  '#33b2b2',
  '#d18616',
  '#cca700',
  '#e879b4',
  '#f14c4c',
];

function laneColor(colorId: number): string {
  return PALETTE[colorId % PALETTE.length]!;
}
