import assert from 'node:assert/strict';
import {
  DEFAULT_WORKBENCH_LAYOUT,
  getWorkbenchPaneSizes,
  setDetailsSplitRatio,
  setWorkbenchPaneSizes,
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

const migratedSaved = {
  ...saved,
  detailsSplitRatio: DEFAULT_WORKBENCH_LAYOUT.detailsSplitRatio,
  views: {
    ...saved.views,
    details: { visible: true, collapsed: false },
  },
};

assert.deepEqual(parseWorkbenchLayout(saved), migratedSaved);
assert.equal(setViewVisible(migratedSaved, 'files', true).views.files.visible, true);
assert.equal(setViewCollapsed(migratedSaved, 'commits', true).views.commits.collapsed, true);
assert.equal(setViewCollapsed(migratedSaved, 'details', true).views.details.collapsed, true);
assert.equal(setSplitRatio(migratedSaved, 100).splitRatio, 80);
assert.equal(setDetailsSplitRatio(migratedSaved, 10).detailsSplitRatio, 20);
assert.deepEqual(getWorkbenchPaneSizes(migratedSaved), {
  commits: 50.4,
  files: 19.6,
  details: 30,
});
assert.deepEqual(
  getWorkbenchPaneSizes(
    setWorkbenchPaneSizes(migratedSaved, { commits: 35, files: 35, details: 30 })
  ),
  { commits: 35, files: 35, details: 30 }
);
assert.equal(saved.views.files.visible, false, 'updates must be immutable');
assert.deepEqual(
  parseWorkbenchLayout({ ...saved, views: { commits: saved.views.commits } }),
  DEFAULT_WORKBENCH_LAYOUT
);

console.log('workbench layout checks passed');
