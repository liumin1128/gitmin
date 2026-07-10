import assert from 'node:assert/strict';
import {
  DEFAULT_WORKBENCH_LAYOUT,
  clampSplitRatio,
  parseWorkbenchLayout,
  setSplitRatio,
  setViewCollapsed,
  setViewVisible,
} from '../webview-ui/src/utils/workbenchLayout.ts';

assert.equal(clampSplitRatio(5), 20);
assert.equal(clampSplitRatio(95), 80);
assert.equal(clampSplitRatio(62), 62);
assert.deepEqual(parseWorkbenchLayout(undefined), DEFAULT_WORKBENCH_LAYOUT);
assert.deepEqual(parseWorkbenchLayout({ version: 2 }), DEFAULT_WORKBENCH_LAYOUT);

const saved = {
  version: 1 as const,
  splitRatio: 72,
  views: {
    commits: { visible: true, collapsed: false },
    files: { visible: false, collapsed: true },
  },
};

assert.deepEqual(parseWorkbenchLayout(saved), saved);
assert.equal(setViewVisible(saved, 'files', true).views.files.visible, true);
assert.equal(setViewCollapsed(saved, 'commits', true).views.commits.collapsed, true);
assert.equal(setSplitRatio(saved, 100).splitRatio, 80);
assert.equal(saved.views.files.visible, false, 'updates must be immutable');
assert.deepEqual(
  parseWorkbenchLayout({ ...saved, views: { commits: saved.views.commits } }),
  DEFAULT_WORKBENCH_LAYOUT
);

console.log('workbench layout checks passed');
