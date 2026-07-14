import assert from 'node:assert/strict';
import {
  DEFAULT_WORKBENCH_LAYOUT,
  parseWorkbenchLayout,
  setWorkbenchPaneSizes,
  setViewCollapsed,
  setViewVisible,
} from '../webview-ui/src/utils/workbenchLayout.ts';

assert.deepEqual(parseWorkbenchLayout(undefined), DEFAULT_WORKBENCH_LAYOUT);
assert.deepEqual(Object.keys(DEFAULT_WORKBENCH_LAYOUT.views), [
  'changes',
  'commits',
  'stashes',
  'files',
  'details',
]);
assert.equal(
  Object.values(DEFAULT_WORKBENCH_LAYOUT.sizes).reduce((sum, size) => sum + size, 0),
  100
);

const version1 = {
  version: 1,
  splitRatio: 60,
  detailsSplitRatio: 70,
  views: {
    commits: { visible: true, collapsed: false },
    files: { visible: false, collapsed: true },
    details: { visible: true, collapsed: false },
  },
};
const migrated = parseWorkbenchLayout(version1);
assert.equal(migrated.version, 2);
assert.equal(migrated.views.files.visible, false);
assert.equal(migrated.views.changes.visible, true);
assert.equal(migrated.views.stashes.visible, true);
assert.equal(setViewVisible(migrated, 'stashes', false).views.stashes.visible, false);
assert.equal(setViewCollapsed(migrated, 'changes', true).views.changes.collapsed, true);

const resized = setWorkbenchPaneSizes(migrated, {
  changes: 20,
  commits: 32,
  stashes: 16,
  files: 16,
  details: 16,
});
assert.deepEqual(resized.sizes, {
  changes: 20,
  commits: 32,
  stashes: 16,
  files: 16,
  details: 16,
});
assert.notEqual(resized, migrated);
assert.equal(migrated.views.files.visible, false, 'updates must be immutable');

console.log('workbench layout checks passed');
