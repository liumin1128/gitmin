import React from 'react';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CommitGraph } from '../webview-ui/src/components/CommitGraph.tsx';
import type { GraphRow } from '../webview-ui/src/utils/commitGraph.ts';

function row(props: Partial<GraphRow> & { commitLane: number; commitColor: number }): GraphRow {
  return {
    topEdges: [],
    bottomEdges: [],
    laneCount: 1,
    ...props,
  };
}

// ===== 独立节点（圆点上下都有短端帽，无拓扑连接线） =====
{
  const html = renderToStaticMarkup(
    <CommitGraph row={row({ commitLane: 0, commitColor: 0 })} maxLanes={1} />
  );
  assert.match(html, /<circle/, 'should have commit dot');
  assert.match(
    html,
    /<line x1="8" y1="3" x2="8" y2="11"/,
    'commit dot should have a short top cap'
  );
  assert.match(
    html,
    /<line x1="8" y1="11" x2="8" y2="19"/,
    'commit dot should have a short bottom cap'
  );
  assert.equal((html.match(/<line/g) || []).length, 2, 'only endpoint caps should be rendered');
  assert.doesNotMatch(html, /<path/, 'no path when no edges');
}

// ===== 普通连线 =====
{
  const r = row({
    commitLane: 0,
    commitColor: 0,
    topEdges: [{ fromLane: 0, toLane: 0, color: 0, type: 'normal' }],
    bottomEdges: [{ fromLane: 0, toLane: 0, color: 0, type: 'normal' }],
  });
  const html = renderToStaticMarkup(<CommitGraph row={r} maxLanes={1} />);
  assert.match(html, /<svg/, 'should have svg');
  assert.match(html, /<circle/, 'should have commit dot');
  const lineCount = (html.match(/<line/g) || []).length;
  assert.equal(lineCount, 2, 'connected node should only have its 2 graph lines');
}

// ===== 片段首节点（顶部端帽 + 向下真实连线） =====
{
  const r = row({
    commitLane: 0,
    commitColor: 0,
    bottomEdges: [{ fromLane: 0, toLane: 0, color: 0, type: 'normal' }],
  });
  const html = renderToStaticMarkup(<CommitGraph row={r} maxLanes={1} />);
  assert.match(html, /<line x1="8" y1="3" x2="8" y2="11"/);
  assert.equal((html.match(/<line/g) || []).length, 2, 'top cap plus bottom graph line');
}

// ===== 分支线（path） =====
{
  const r = row({
    commitLane: 0,
    commitColor: 0,
    bottomEdges: [{ fromLane: 0, toLane: 1, color: 1, type: 'branch' }],
    laneCount: 2,
  });
  const html = renderToStaticMarkup(<CommitGraph row={r} maxLanes={2} />);
  assert.match(html, /<path/, 'branch edges should use path');
}

// ===== merge 线 =====
{
  const r = row({
    commitLane: 1,
    commitColor: 1,
    bottomEdges: [{ fromLane: 1, toLane: 0, color: 0, type: 'merge' }],
    laneCount: 2,
  });
  const html = renderToStaticMarkup(<CommitGraph row={r} maxLanes={2} />);
  assert.match(html, /<path/, 'merge edges should use path');
}

// ===== 多 lane 渲染 =====
{
  const r = row({
    commitLane: 0,
    commitColor: 0,
    topEdges: [{ fromLane: 1, toLane: 1, color: 1, type: 'normal' }],
    bottomEdges: [
      { fromLane: 0, toLane: 0, color: 0, type: 'normal' },
      { fromLane: 0, toLane: 1, color: 1, type: 'branch' },
    ],
    laneCount: 2,
  });
  const html = renderToStaticMarkup(<CommitGraph row={r} maxLanes={2} />);
  assert.match(html, /width="32"/, 'svg width should be 2 * LANE_W');
  assert.match(html, /height="22"/, 'svg height should be ROW_H');
}

// ===== 颜色输出验证 =====
{
  const r = row({ commitLane: 0, commitColor: 0 });
  const html = renderToStaticMarkup(<CommitGraph row={r} maxLanes={1} />);
  assert.match(html, /fill:#89d185/, 'the first graph segment should use green');
}

{
  const r = row({ commitLane: 0, commitColor: 7 });
  const html = renderToStaticMarkup(<CommitGraph row={r} maxLanes={1} />);
  assert.match(html, /fill:#f14c4c/, 'palette color 7 should wrap to red');
}

console.log('✅ CommitGraph SVG tests passed');
