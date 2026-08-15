/**
 * SVG renderer for one row of the commit graph. Topology is calculated by the
 * pure layout utility; this component only renders the resulting swimlanes.
 */
import type { GraphColor, GraphEdge, GraphRow } from '../utils/commitGraph';
import {
  COMMIT_GRAPH_LANE_WIDTH,
  COMMIT_GRAPH_ROW_HEIGHT,
  commitGraphLaneX,
  commitGraphWidth,
} from '../utils/commitGraphGeometry';

const CURVE_RADIUS = 5;
const CIRCLE_RADIUS = 4;
const CIRCLE_STROKE_WIDTH = 2;
const STROKE_WIDTH = 1;
const UNPUSHED_COLOR = 'var(--vscode-editorWarning-foreground, #cca700)';
const CURRENT_REF_COLOR =
  'var(--vscode-scmGraph-historyItemRefColor, var(--vscode-charts-blue, #75BEFF))';

interface Props {
  row: GraphRow;
  maxLanes: number;
  isUnpushed?: boolean;
}

export function CommitGraph({ row, maxLanes, isUnpushed = false }: Props) {
  const width = commitGraphWidth(maxLanes);
  const commitX = commitGraphLaneX(row.commitLane);
  const commitColor = isUnpushed ? UNPUSHED_COLOR : laneColor(row.commitColor);

  return (
    <svg
      aria-hidden="true"
      className={`commit-graph is-${row.nodeKind}`}
      focusable="false"
      width={width}
      height={COMMIT_GRAPH_ROW_HEIGHT}
      viewBox={`0 0 ${width} ${COMMIT_GRAPH_ROW_HEIGHT}`}
    >
      {row.passingEdges.map((edge, index) => (
        <PassingEdge key={`p${index}`} edge={edge} />
      ))}
      {row.incomingEdges.map((edge, index) => (
        <IncomingEdge
          key={`i${index}`}
          edge={edge}
          colorOverride={isUnpushed ? UNPUSHED_COLOR : undefined}
        />
      ))}
      {row.outgoingEdges.map((edge, index) => (
        <OutgoingEdge
          key={`o${index}`}
          edge={edge}
          colorOverride={isUnpushed ? UNPUSHED_COLOR : undefined}
        />
      ))}
      {row.nodeKind === 'head' ? (
        <>
          <CommitCircle cx={commitX} radius={CIRCLE_RADIUS + 3} color={commitColor} />
          <CommitCircle
            className="commit-node-inner"
            cx={commitX}
            radius={CIRCLE_STROKE_WIDTH}
            strokeWidth={CIRCLE_RADIUS}
          />
        </>
      ) : row.nodeKind === 'merge' ? (
        <>
          <CommitCircle cx={commitX} radius={CIRCLE_RADIUS + 2} color={commitColor} />
          <CommitCircle cx={commitX} radius={CIRCLE_RADIUS - 1} color={commitColor} />
        </>
      ) : (
        <CommitCircle cx={commitX} radius={CIRCLE_RADIUS + 1} color={commitColor} />
      )}
    </svg>
  );
}

function PassingEdge({ edge }: { edge: GraphEdge }) {
  const x1 = commitGraphLaneX(edge.fromLane);
  const x2 = commitGraphLaneX(edge.toLane);
  const style = edgeStyle(laneColor(edge.color));

  if (x1 === x2) {
    return (
      <line
        x1={x1}
        y1={0}
        x2={x2}
        y2={COMMIT_GRAPH_ROW_HEIGHT}
        style={style}
      />
    );
  }

  const midY = COMMIT_GRAPH_ROW_HEIGHT / 2;
  const direction = Math.sign(x2 - x1);
  const firstSweep = direction < 0 ? 1 : 0;
  const secondSweep = direction < 0 ? 0 : 1;
  const d = [
    `M ${x1} 0`,
    `V ${midY - CURVE_RADIUS}`,
    `A ${CURVE_RADIUS} ${CURVE_RADIUS} 0 0 ${firstSweep} ${x1 + direction * CURVE_RADIUS} ${midY}`,
    `H ${x2 - direction * CURVE_RADIUS}`,
    `A ${CURVE_RADIUS} ${CURVE_RADIUS} 0 0 ${secondSweep} ${x2} ${midY + CURVE_RADIUS}`,
    `V ${COMMIT_GRAPH_ROW_HEIGHT}`,
  ].join(' ');

  return <path d={d} fill="none" style={style} />;
}

function IncomingEdge({
  edge,
  colorOverride,
}: {
  edge: GraphEdge;
  colorOverride?: string;
}) {
  const x1 = commitGraphLaneX(edge.fromLane);
  const x2 = commitGraphLaneX(edge.toLane);
  const midY = COMMIT_GRAPH_ROW_HEIGHT / 2;
  const style = edgeStyle(colorOverride ?? laneColor(edge.color));

  if (x1 === x2) {
    return <line x1={x1} y1={0} x2={x2} y2={midY} style={style} />;
  }

  const direction = Math.sign(x2 - x1);
  const sweep = direction < 0 ? 1 : 0;
  const arcEndX = x1 + direction * COMMIT_GRAPH_LANE_WIDTH;
  const d = [
    `M ${x1} 0`,
    `A ${COMMIT_GRAPH_LANE_WIDTH} ${COMMIT_GRAPH_LANE_WIDTH} 0 0 ${sweep} ${arcEndX} ${midY}`,
    `H ${x2}`,
  ].join(' ');

  return <path d={d} fill="none" style={style} />;
}

function OutgoingEdge({
  edge,
  colorOverride,
}: {
  edge: GraphEdge;
  colorOverride?: string;
}) {
  const x1 = commitGraphLaneX(edge.fromLane);
  const x2 = commitGraphLaneX(edge.toLane);
  const midY = COMMIT_GRAPH_ROW_HEIGHT / 2;
  const style = edgeStyle(colorOverride ?? laneColor(edge.color));

  if (x1 === x2) {
    return (
      <line
        x1={x1}
        y1={midY}
        x2={x2}
        y2={COMMIT_GRAPH_ROW_HEIGHT}
        style={style}
      />
    );
  }

  const direction = Math.sign(x2 - x1);
  const sweep = direction > 0 ? 1 : 0;
  const arcStartX = x2 - direction * COMMIT_GRAPH_LANE_WIDTH;
  const d = [
    `M ${arcStartX} ${midY}`,
    `A ${COMMIT_GRAPH_LANE_WIDTH} ${COMMIT_GRAPH_LANE_WIDTH} 0 0 ${sweep} ${x2} ${COMMIT_GRAPH_ROW_HEIGHT}`,
    `M ${arcStartX} ${midY}`,
    `H ${x1}`,
  ].join(' ');

  return <path d={d} fill="none" style={style} />;
}

function CommitCircle({
  cx,
  radius,
  color,
  className,
  strokeWidth = CIRCLE_STROKE_WIDTH,
}: {
  cx: number;
  radius: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <circle
      className={className}
      cx={cx}
      cy={COMMIT_GRAPH_ROW_HEIGHT / 2}
      r={radius}
      style={{ fill: color, strokeWidth }}
    />
  );
}

function edgeStyle(color: string) {
  return {
    stroke: color,
    strokeWidth: STROKE_WIDTH,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

const PALETTE: string[] = [
  'var(--vscode-scmGraph-foreground1, #FFB000)',
  'var(--vscode-scmGraph-foreground2, #DC267F)',
  'var(--vscode-scmGraph-foreground3, #994F00)',
  'var(--vscode-scmGraph-foreground4, #40B0A6)',
  'var(--vscode-scmGraph-foreground5, #B66DFF)',
];

function laneColor(colorId: GraphColor): string {
  if (colorId === 'current') return CURRENT_REF_COLOR;
  return PALETTE[colorId % PALETTE.length]!;
}
