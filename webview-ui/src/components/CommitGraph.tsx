/**
 * Commit graph single-row SVG renderer
 * - Same-lane edges: vertical solid line
 * - Cross-lane edges (branch/merge): smooth cubic path
 * - First/last node in a history segment renders short vertical end caps
 */
import type { GraphRow, GraphEdge } from '../utils/commitGraph';

const LANE_W = 16;
const ROW_H = 22;
const DOT_R = 3;
const STROKE_W = 1;
const END_CAP_H = 8;
const UNPUSHED_COLOR = 'var(--vscode-editorWarning-foreground, #cca700)';

interface Props {
  row: GraphRow;
  maxLanes: number;
  isUnpushed?: boolean;
}

export function CommitGraph({ row, maxLanes, isUnpushed = false }: Props) {
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
        <EdgePath
          key={`t${i}`}
          edge={e}
          yStart={0}
          yEnd={midY}
          colorOverride={isUnpushed && e.toLane === row.commitLane ? UNPUSHED_COLOR : undefined}
        />
      ))}
      {row.bottomEdges.map((e, i) => (
        <EdgePath
          key={`b${i}`}
          edge={e}
          yStart={midY}
          yEnd={height}
          colorOverride={isUnpushed && e.fromLane === row.commitLane ? UNPUSHED_COLOR : undefined}
        />
      ))}
      {!hasTopConnection && (
        <line
          x1={commitX}
          y1={midY - END_CAP_H}
          x2={commitX}
          y2={midY}
          style={edgeStyle(isUnpushed ? UNPUSHED_COLOR : commitColor)}
        />
      )}
      {!hasBottomConnection && (
        <line
          x1={commitX}
          y1={midY}
          x2={commitX}
          y2={midY + END_CAP_H}
          style={edgeStyle(isUnpushed ? UNPUSHED_COLOR : commitColor)}
        />
      )}
      <circle
        cx={commitX}
        cy={midY}
        r={DOT_R}
        style={{ fill: isUnpushed ? UNPUSHED_COLOR : commitColor }}
      />
    </svg>
  );
}

function EdgePath({
  edge,
  yStart,
  yEnd,
  colorOverride,
}: {
  edge: GraphEdge;
  yStart: number;
  yEnd: number;
  colorOverride?: string;
}) {
  const x1 = laneX(edge.fromLane);
  const x2 = laneX(edge.toLane);
  const color = colorOverride ?? laneColor(edge.color);
  const sameLane = edge.fromLane === edge.toLane;

  if (sameLane) {
    return (
      <line
        x1={x1} y1={yStart} x2={x2} y2={yEnd}
        style={edgeStyle(color)}
      />
    );
  }

  const midY = (yStart + yEnd) / 2;

  const d = [
    `M ${x1} ${yStart}`,
    `C ${x1} ${midY} ${x2} ${midY} ${x2} ${yEnd}`,
  ].join(' ');

  return (
    <path
      d={d}
      fill="none"
      style={edgeStyle(color)}
    />
  );
}

function edgeStyle(color: string) {
  return {
    stroke: color,
    strokeWidth: STROKE_W,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
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
