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
 * 颜色循环取模：前 6 色复用 VSCode 主题变量，后续自定义色保证可区分性
 */
const PALETTE: Array<{ cssVar?: string; color: string }> = [
  { cssVar: '--vscode-charts-red',    color: '#f14c4c' },
  { cssVar: '--vscode-charts-blue',   color: '#3794ff' },
  { cssVar: '--vscode-charts-green',  color: '#89d185' },
  { cssVar: '--vscode-charts-orange', color: '#d18616' },
  { cssVar: '--vscode-charts-purple', color: '#b180d7' },
  { cssVar: '--vscode-charts-yellow', color: '#cca700' },
  { color: '#33b2b2' },
  { color: '#e879b4' },
  { color: '#7ecf7e' },
  { color: '#b59a6b' },
  { color: '#6cb6ff' },
  { color: '#d484ff' },
];

function laneColor(colorId: number): string {
  const entry = PALETTE[colorId % PALETTE.length]!;
  if (entry.cssVar) {
    return `var(${entry.cssVar}, ${entry.color})`;
  }
  return entry.color;
}
