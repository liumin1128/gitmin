import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WorkbenchPanelStack,
  type WorkbenchPanelDefinition,
} from '../webview-ui/src/components/WorkbenchPanelStack';
import {
  PANEL_HEADER_HEIGHT,
  calculatePanelHeights,
  calculatePanelMaximumHeight,
  clampPanelHeight,
} from '../webview-ui/src/utils/panelSizing';
import { ViewVisibilityMenu } from '../webview-ui/src/components/ViewVisibilityMenu';

const panels: WorkbenchPanelDefinition[] = [
  {
    id: 'repositories',
    title: 'Repositories',
    count: 2,
    visible: true,
    collapsed: false,
    content: <div>repository list</div>,
  },
  {
    id: 'changes',
    title: 'Changes',
    count: 3,
    visible: true,
    collapsed: true,
    content: <div>hidden changes</div>,
  },
  {
    id: 'commits',
    title: 'Commits',
    count: 12,
    visible: true,
    collapsed: false,
    actions: <button type="button">refresh</button>,
    content: <div>commit list</div>,
  },
  {
    id: 'stashes',
    title: 'Stashes',
    count: 2,
    visible: true,
    collapsed: false,
    content: <div>stash list</div>,
  },
  {
    id: 'files',
    title: 'Changed Files',
    visible: true,
    collapsed: false,
    content: <div>file list</div>,
  },
  {
    id: 'details',
    title: 'Commit Details',
    visible: true,
    collapsed: false,
    content: <div>commit details</div>,
  },
];

const heights = {
  repositories: null,
  changes: null,
  commits: null,
  stashes: null,
  files: null,
  details: null,
};

const html = renderToStaticMarkup(
  <>
    <WorkbenchPanelStack
      panels={panels}
      heights={heights}
      lastResizedPanel={null}
      onCollapsedChange={() => undefined}
      onHeightChange={() => undefined}
    />
    <ViewVisibilityMenu
      views={Object.fromEntries(
        panels.map((panel) => [panel.id, { visible: panel.visible, collapsed: panel.collapsed }])
      ) as never}
      onVisibleChange={() => undefined}
      open
    />
  </>
);

assert.equal((html.match(/data-workbench-panel=/g) ?? []).length, 6);
assert.ok(
  html.indexOf('data-workbench-panel="repositories"') <
    html.indexOf('data-workbench-panel="changes"')
);
assert.match(html, /aria-label="Collapse Repositories"/);
assert.match(html, /aria-label="Expand Changes"/);
assert.match(html, /workbench-panel-chevron codicon codicon-chevron-down/);
assert.match(html, /workbench-panel-chevron codicon codicon-chevron-right/);
assert.match(html, />Repositories</);
assert.match(html, />Commit Details</);
assert.match(html, /repository list/);
assert.doesNotMatch(html, /hidden changes/);
assert.equal((html.match(/role="separator"/g) ?? []).length, 4);
assert.match(html, /aria-orientation="horizontal"/);
assert.match(html, /title="Manage views"/);
assert.match(html, /aria-expanded="true"/);
assert.match(html, /role="menu"/);
assert.equal((html.match(/aria-checked="true"/g) ?? []).length, 6);
assert.equal((html.match(/codicon-check/g) ?? []).length, 6);

const natural = calculatePanelHeights(
  [
    { id: 'repositories', collapsed: false, preferredHeight: null, naturalHeight: 74 },
    { id: 'changes', collapsed: true, preferredHeight: null, naturalHeight: 200 },
    { id: 'commits', collapsed: false, preferredHeight: null, naturalHeight: 120 },
  ],
  500
);
assert.deepEqual(natural, { repositories: 84, changes: PANEL_HEADER_HEIGHT, commits: 390 });

const manual = calculatePanelHeights(
  [
    { id: 'repositories', collapsed: false, preferredHeight: 180, naturalHeight: 74 },
    { id: 'changes', collapsed: true, preferredHeight: null, naturalHeight: 200 },
    { id: 'commits', collapsed: false, preferredHeight: null, naturalHeight: 80 },
  ],
  400
);
assert.deepEqual(manual, { repositories: 180, changes: PANEL_HEADER_HEIGHT, commits: 194 });

const fitted = calculatePanelHeights(
  [
    { id: 'repositories', collapsed: false, preferredHeight: null, naturalHeight: 300 },
    { id: 'changes', collapsed: true, preferredHeight: null, naturalHeight: 200 },
    { id: 'commits', collapsed: false, preferredHeight: null, naturalHeight: 200 },
  ],
  326
);
assert.deepEqual(fitted, { repositories: 169, changes: PANEL_HEADER_HEIGHT, commits: 131 });
assert.equal(clampPanelHeight(20, 250), 84);
assert.equal(clampPanelHeight(400, 250), 250);

const draggedUp = calculatePanelHeights(
  [
    { id: 'commits', collapsed: false, preferredHeight: 260, naturalHeight: 300 },
    { id: 'files', collapsed: false, preferredHeight: 300, naturalHeight: 300 },
  ],
  600
);
const draggedDown = calculatePanelHeights(
  [
    { id: 'commits', collapsed: false, preferredHeight: 340, naturalHeight: 300 },
    { id: 'files', collapsed: false, preferredHeight: 300, naturalHeight: 300 },
  ],
  600
);
assert.deepEqual(draggedUp, { commits: 260, files: 340 });
assert.deepEqual(draggedDown, { commits: 318, files: 282 });
assert.deepEqual(
  calculatePanelHeights(
    [
      { id: 'commits', collapsed: false, preferredHeight: 340, naturalHeight: 300 },
      { id: 'files', collapsed: false, preferredHeight: null, naturalHeight: 300 },
    ],
    600,
    'commits'
  ),
  { commits: 340, files: 260 },
  'the last resized panel reaches its requested height'
);

const draggedToMaximum = [
  { id: 'commits', collapsed: false, preferredHeight: 516, naturalHeight: 300 },
  { id: 'files', collapsed: false, preferredHeight: null, naturalHeight: 300 },
];
assert.equal(calculatePanelMaximumHeight(draggedToMaximum, 'commits', 600), 516);
assert.deepEqual(calculatePanelHeights(draggedToMaximum, 600, 'commits'), {
  commits: 516,
  files: 84,
});

const independentlySized = [
  { id: 'changes', collapsed: false, preferredHeight: 200, naturalHeight: 200 },
  { id: 'commits', collapsed: false, preferredHeight: 350, naturalHeight: 300 },
  { id: 'files', collapsed: false, preferredHeight: 300, naturalHeight: 300 },
];
assert.equal(calculatePanelMaximumHeight(independentlySized, 'commits', 600), 432);
assert.deepEqual(calculatePanelHeights(independentlySized, 600), {
  changes: 151,
  commits: 238,
  files: 211,
});

// A panel dragged far beyond the available room must not starve the trailing
// panels down to a blank strip (reported for Changed Files / Commit Details).
const crowded = calculatePanelHeights(
  [
    { id: 'repositories', collapsed: true, preferredHeight: 26, naturalHeight: 56 },
    { id: 'changes', collapsed: false, preferredHeight: 177, naturalHeight: 220 },
    { id: 'commits', collapsed: false, preferredHeight: 835, naturalHeight: 835 },
    { id: 'stashes', collapsed: false, preferredHeight: null, naturalHeight: 149 },
    { id: 'files', collapsed: false, preferredHeight: null, naturalHeight: 70 },
    { id: 'details', collapsed: false, preferredHeight: null, naturalHeight: 204 },
  ],
  1200
);
assert.deepEqual(crowded, {
  repositories: 26,
  changes: 152,
  commits: 634,
  stashes: 131,
  files: 84,
  details: 173,
});
assert.ok(
  crowded.files - PANEL_HEADER_HEIGHT >= 44 &&
    crowded.details - PANEL_HEADER_HEIGHT >= 120,
  'trailing panels keep room for their content instead of collapsing to the header'
);
assert.ok(
  Object.values(crowded).reduce((total, height) => total + height, 0) === 1200,
  'panel heights fill the stack exactly'
);

const compactPanels = ['changes', 'commits', 'stashes', 'files', 'details'].map((id) => ({
  id,
  collapsed: false,
  preferredHeight: null,
  naturalHeight: 120,
}));
const compact = calculatePanelHeights(compactPanels, 400);
assert.ok(Object.values(compact).every((height) => height === 84));
assert.equal(calculatePanelMaximumHeight(compactPanels, 'commits', 400), 84);
assert.equal(Object.values(compact).reduce((total, height) => total + height, 0), 420);

const styles = readFileSync('webview-ui/src/styles.css', 'utf8');
assert.match(styles, /\.workbench-panel-stack\s*\{[^}]*align-items:\s*stretch/s);
assert.match(styles, /\.workbench-panel-stack\s*\{[^}]*overflow-y:\s*auto/s);
assert.match(styles, /\.workbench-panel\s*\{[^}]*flex:\s*0\s+0\s+var\(--panel-height\)/s);
assert.match(styles, /\.workbench-panel-content\s*\{[^}]*overflow:\s*auto/s);
assert.doesNotMatch(styles, /\.view-section\s*\{/);

console.log('workbench component checks passed');
