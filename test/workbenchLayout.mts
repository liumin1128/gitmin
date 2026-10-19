import assert from 'node:assert/strict';
import {
  DEFAULT_WORKBENCH_LAYOUT,
  parseWorkbenchLayout,
  setWorkbenchPanelHeight,
  setViewCollapsed,
  setViewVisible,
} from '../webview-ui/src/utils/workbenchLayout.ts';

assert.deepEqual(parseWorkbenchLayout(undefined), DEFAULT_WORKBENCH_LAYOUT);
assert.equal(DEFAULT_WORKBENCH_LAYOUT.version, 4);
assert.deepEqual(Object.keys(DEFAULT_WORKBENCH_LAYOUT.views), [
  'repositories',
  'changes',
  'commits',
  'stashes',
  'files',
  'details',
]);
assert.deepEqual(
  Object.entries(DEFAULT_WORKBENCH_LAYOUT.views)
    .filter(([, view]) => view.visible)
    .map(([id]) => id),
  ['commits', 'files'],
  'only Commits and Changed Files should be visible by default'
);
assert.ok(Object.values(DEFAULT_WORKBENCH_LAYOUT.heights).every((height) => height === null));

const version3 = {
  version: 3,
  sizes: {
    repositories: 12,
    changes: 18,
    commits: 28,
    stashes: 14,
    files: 14,
    details: 14,
  },
  views: {
    repositories: { visible: true, collapsed: true },
    changes: { visible: true, collapsed: false },
    commits: { visible: true, collapsed: false },
    stashes: { visible: false, collapsed: false },
    files: { visible: true, collapsed: false },
    details: { visible: true, collapsed: false },
  },
};
const migratedVersion3 = parseWorkbenchLayout(version3);
assert.equal(migratedVersion3.version, 4);
assert.equal(migratedVersion3.views.repositories.collapsed, true);
assert.equal(migratedVersion3.views.stashes.visible, false);
assert.ok(Object.values(migratedVersion3.heights).every((height) => height === null));

const updated = setWorkbenchPanelHeight(migratedVersion3, 'commits', 280);
assert.equal(updated.heights.commits, 280);
assert.equal(updated.lastResizedPanel, 'commits');
const resetHeight = setWorkbenchPanelHeight(updated, 'commits', null);
assert.equal(resetHeight.heights.commits, null);
assert.equal(resetHeight.lastResizedPanel, null);
assert.equal(setWorkbenchPanelHeight(updated, 'commits', -1), updated);
assert.equal(setViewVisible(updated, 'stashes', true).views.stashes.visible, true);
assert.equal(setViewCollapsed(updated, 'changes', true).views.changes.collapsed, true);
assert.equal(migratedVersion3.heights.commits, null, 'updates must be immutable');

// A stored height below the expanded minimum only shows the panel header, which
// reads as a blank Changed Files / Commit Details panel; it must fall back to
// automatic sizing instead of being kept.
const squeezed = parseWorkbenchLayout({
  version: 4,
  heights: {
    repositories: 26,
    changes: 177,
    commits: 835,
    stashes: null,
    files: 26,
    details: 50,
  },
  views: DEFAULT_WORKBENCH_LAYOUT.views,
});
assert.equal(squeezed.heights.files, null, 'sub-minimum heights become automatic');
assert.equal(squeezed.heights.details, null, 'sub-minimum heights become automatic');
assert.equal(squeezed.heights.commits, 835, 'usable heights are preserved');
assert.equal(squeezed.lastResizedPanel, null, 'older layouts have no resize priority');
assert.equal(setWorkbenchPanelHeight(updated, 'commits', 30).heights.commits, null);

const restored = parseWorkbenchLayout({
  ...updated,
  lastResizedPanel: 'commits',
});
assert.equal(restored.lastResizedPanel, 'commits');
assert.equal(parseWorkbenchLayout({ ...restored, lastResizedPanel: 'invalid' }).lastResizedPanel, null);
assert.equal(
  parseWorkbenchLayout({ ...restored, heights: { ...restored.heights, commits: 30 } }).lastResizedPanel,
  null,
  'a discarded height cannot retain resize priority'
);

console.log('workbench layout checks passed');
