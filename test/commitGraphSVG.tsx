import React from 'react';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CommitGraph } from '../webview-ui/src/components/CommitGraph.tsx';
import { CommitItem } from '../webview-ui/src/components/CommitItem.tsx';
import type { GraphRow } from '../webview-ui/src/utils/commitGraph.ts';

function row(
  props: Partial<GraphRow> & {
    commitLane: number;
    commitColor: GraphRow['commitColor'];
  }
): GraphRow {
  return {
    nodeKind: 'node',
    incomingEdges: [],
    outgoingEdges: [],
    passingEdges: [],
    laneCount: 1,
    ...props,
  };
}

// Isolated nodes render only the node, matching VS Code's graph renderer.
{
  const html = renderToStaticMarkup(
    <CommitGraph row={row({ commitLane: 0, commitColor: 0 })} />
  );

  assert.match(html, /<circle/, 'should have commit dot');
  assert.match(html, /width="22"/);
  assert.match(html, /<circle cx="11" cy="11" r="5"/);
  assert.doesNotMatch(html, /<line/);
  assert.doesNotMatch(html, /<path/);
}

// A linear commit has one line into and one line out of its node.
{
  const graphRow = row({
    commitLane: 0,
    commitColor: 0,
    incomingEdges: [{ fromLane: 0, toLane: 0, color: 0 }],
    outgoingEdges: [{ fromLane: 0, toLane: 0, color: 0 }],
  });
  const html = renderToStaticMarkup(<CommitGraph row={graphRow} />);

  assert.equal((html.match(/<line/g) || []).length, 2);
  assert.doesNotMatch(html, /<path/);
}

// A segment tip renders only its real outgoing edge.
{
  const graphRow = row({
    commitLane: 0,
    commitColor: 0,
    outgoingEdges: [{ fromLane: 0, toLane: 0, color: 0 }],
  });
  const html = renderToStaticMarkup(<CommitGraph row={graphRow} />);

  assert.match(html, /<line x1="11" y1="11" x2="11" y2="22"/);
  assert.equal((html.match(/<line/g) || []).length, 1);
}

// Secondary parents curve from the commit node into their output lane.
{
  const graphRow = row({
    commitLane: 0,
    commitColor: 0,
    outgoingEdges: [{ fromLane: 0, toLane: 1, color: 1 }],
    laneCount: 2,
  });
  const html = renderToStaticMarkup(<CommitGraph row={graphRow} />);

  assert.match(html, /d="M 11 11 A 11 11 0 0 1 22 22 M 11 11 H 11"/);
  assert.match(html, /stroke-linecap:round/);
  assert.match(html, /stroke-linejoin:round/);
}

// Duplicate incoming lanes converge into one commit node.
{
  const graphRow = row({
    commitLane: 0,
    commitColor: 0,
    incomingEdges: [{ fromLane: 1, toLane: 0, color: 1 }],
    laneCount: 2,
  });
  const html = renderToStaticMarkup(<CommitGraph row={graphRow} />);

  assert.match(html, /d="M 22 0 A 11 11 0 0 1 11 11 H 11"/);
}

// A lane closing compacts the remaining lanes with a rounded two-corner path.
{
  const graphRow = row({
    commitLane: 0,
    commitColor: 0,
    incomingEdges: [{ fromLane: 0, toLane: 0, color: 0 }],
    passingEdges: [{ fromLane: 1, toLane: 0, color: 1 }],
    laneCount: 2,
  });
  const html = renderToStaticMarkup(<CommitGraph row={graphRow} />);

  assert.match(html, /d="M 22 0 V 6 A 5 5 0 0 1 17 11 H 16 A 5 5 0 0 0 11 16 V 22"/);
}

// SVG width follows the current row's active lanes instead of the list maximum.
{
  const graphRow = row({
    commitLane: 0,
    commitColor: 0,
    passingEdges: [{ fromLane: 1, toLane: 1, color: 1 }],
    outgoingEdges: [
      { fromLane: 0, toLane: 0, color: 0 },
      { fromLane: 0, toLane: 1, color: 1 },
    ],
    nodeKind: 'merge',
    laneCount: 2,
  });
  const html = renderToStaticMarkup(<CommitGraph row={graphRow} />);

  assert.match(html, /width="33"/);
  assert.match(html, /height="22"/);
  assert.equal((html.match(/<circle/g) || []).length, 2, 'merge nodes use two circles');
  assert.match(html, /<circle cx="11" cy="11" r="6"/);
  assert.match(html, /<circle cx="11" cy="11" r="3"/);
}

// HEAD uses VS Code's current-ref color and double-ring marker.
{
  const html = renderToStaticMarkup(
    <CommitGraph
      row={row({ commitLane: 0, commitColor: 'current', nodeKind: 'head' })}
    />
  );

  assert.match(html, /class="commit-graph is-head"/);
  assert.match(html, /<circle cx="11" cy="11" r="7"/);
  assert.match(html, /class="commit-node-inner" cx="11" cy="11" r="2"/);
  assert.match(html, /stroke-width:4/);
  assert.match(html, /fill:var\(--vscode-scmGraph-historyItemRefColor/);
}

// Palette colors and local-commit highlighting are preserved.
{
  const html = renderToStaticMarkup(
    <CommitGraph row={row({ commitLane: 0, commitColor: 0 })} />
  );
  assert.match(html, /fill:var\(--vscode-scmGraph-foreground1, #FFB000\)/);
}

{
  const html = renderToStaticMarkup(
    <CommitGraph row={row({ commitLane: 0, commitColor: 7 })} />
  );
  assert.match(html, /fill:var\(--vscode-scmGraph-foreground3, #994F00\)/);
}

{
  const graphRow = row({
    commitLane: 0,
    commitColor: 0,
    outgoingEdges: [{ fromLane: 0, toLane: 0, color: 0 }],
  });
  const html = renderToStaticMarkup(<CommitGraph row={graphRow} isUnpushed />);

  assert.match(html, /fill:var\(--vscode-editorWarning-foreground, #cca700\)/);
  assert.match(html, /stroke:var\(--vscode-editorWarning-foreground, #cca700\)/);
}

{
  const html = renderToStaticMarkup(
    <CommitItem
      commit={{
        hash: 'local',
        shortHash: 'local',
        message: 'local commit',
        author: 'Alice',
        email: 'alice@example.test',
        date: '2026-07-22T00:00:00Z',
        parents: ['remote'],
        refs: ['HEAD -> main'],
        isUnpushed: true,
      }}
      columns={{ graph: false, hash: false, author: false, time: false, tags: true }}
      graphRow={row({ commitLane: 0, commitColor: 0 })}
      selected={false}
      onClick={() => undefined}
      onContextMenu={() => undefined}
    />
  );
  assert.match(html, /class="commit-summary"><span class="commit-message"/);
  assert.match(html, /class="commit-tag is-unpushed">HEAD -&gt; main<\/span>/);
}

console.log('commit graph SVG tests passed');
