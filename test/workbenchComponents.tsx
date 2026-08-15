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
      onCollapsedChange={() => undefined}
      onHeightChange={() => undefined}
    />
    <ViewVisibilityMenu
      views={Object.fromEntries(
        panels.map((panel) => [panel.id, { visible: panel.visible, collapsed: panel.collapsed }])
      ) as never}
      onVisibleChange={() => undefined}
    />
  </>
);

assert.equal((html.match(/data-workbench-panel=/g) ?? []).length, 6);
assert.ok(
  html.indexOf('data-workbench-panel="repositories"') <
    html.indexOf('data-workbench-panel="changes"')
);
assert.match(html, /aria-label="CollapseRepositories"/);
assert.match(html, /aria-label="ExpandChanges"/);
assert.match(html, />Repositories</);
assert.match(html, />Commit Details</);
assert.match(html, /repository list/);
assert.doesNotMatch(html, /hidden changes/);
assert.equal((html.match(/role="separator"/g) ?? []).length, 4);
assert.match(html, /aria-orientation="horizontal"/);
assert.match(html, /title="Manage views"/);

const natural = calculatePanelHeights(
  [
    { id: 'repositories', collapsed: false, preferredHeight: null, naturalHeight: 74 },
    { id: 'changes', collapsed: true, preferredHeight: null, naturalHeight: 200 },
    { id: 'commits', collapsed: false, preferredHeight: null, naturalHeight: 120 },
  ],
  500
);
assert.deepEqual(natural, { repositories: 74, changes: PANEL_HEADER_HEIGHT, commits: 400 });

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
assert.deepEqual(fitted, { repositories: 175, changes: PANEL_HEADER_HEIGHT, commits: 125 });
assert.equal(clampPanelHeight(20, 250), 50);
assert.equal(clampPanelHeight(400, 250), 250);

const styles = readFileSync('webview-ui/src/styles.css', 'utf8');
assert.match(styles, /\.workbench-panel-stack\s*\{[^}]*align-items:\s*stretch/s);
assert.match(styles, /\.workbench-panel\s*\{[^}]*flex:\s*0\s+0\s+var\(--panel-height\)/s);
assert.match(styles, /\.workbench-panel-content\s*\{[^}]*overflow:\s*auto/s);
assert.doesNotMatch(styles, /\.view-section\s*\{/);

console.log('workbench component checks passed');
