/**
 * commit graph 单行 SVG 渲染（纯展示）
 * - 圆点在 (commitLane * LANE_W + LANE_W/2, ROW_H/2)
 * - 每条 edge 分上下半段：顶边→中心 / 中心→底边
 * - 直线段 = fromLane === toLane 时的垂直线；否则斜线
 */
import type { GraphRow } from '../utils/commitGraph';

const LANE_W = 12;
const ROW_H = 22;
const DOT_R = 3.5;
const STROKE_W = 1.5;

interface Props {
  row: GraphRow;
  maxLanes: number;
}

export function CommitGraph({ row, maxLanes }: Props) {
  const width = maxLanes * LANE_W;
  const height = ROW_H;
  const midY = height / 2;

  return (
    <svg className="commit-graph" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {row.topEdges.map((e, i) => (
        <line
          key={`t${i}`}
          x1={laneX(e.fromLane)}
          y1={0}
          x2={laneX(e.toLane)}
          y2={midY}
          stroke={laneColor(e.color)}
          strokeWidth={STROKE_W}
        />
      ))}
      {row.bottomEdges.map((e, i) => (
        <line
          key={`b${i}`}
          x1={laneX(e.fromLane)}
          y1={midY}
          x2={laneX(e.toLane)}
          y2={height}
          stroke={laneColor(e.color)}
          strokeWidth={STROKE_W}
        />
      ))}
      <circle
        cx={laneX(row.commitLane)}
        cy={midY}
        r={DOT_R}
        fill={laneColor(row.commitColor)}
      />
    </svg>
  );
}

function laneX(lane: number): number {
  return lane * LANE_W + LANE_W / 2;
}

/**
 * 颜色循环取模：CSS 变量优先，无值时回退硬编码色
 * 用 var() + fallback 实现"变量存在就取变量，否则用备用色"
 */
const PALETTE: Array<[string, string]> = [
  ['--vscode-charts-red', '#f14c4c'],
  ['--vscode-charts-blue', '#3794ff'],
  ['--vscode-charts-yellow', '#e2c08d'],
  ['--vscode-charts-orange', '#d18616'],
  ['--vscode-charts-green', '#89d185'],
  ['--vscode-charts-purple', '#b180d7'],
  ['--vscode-charts-foreground', '#cccccc'],
  ['--vscode-charts-lines', '#8b8b8b'],
];

function laneColor(colorId: number): string {
  const [varName, fallback] = PALETTE[colorId % PALETTE.length]!;
  return `var(${varName}, ${fallback})`;
}
