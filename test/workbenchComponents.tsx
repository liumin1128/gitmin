import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResizableSplitView } from '../webview-ui/src/components/ResizableSplitView';
import {
  ResizablePanelStack,
  resizeAdjacentPaneSizes,
} from '../webview-ui/src/components/ResizablePanelStack';
import { ViewSection } from '../webview-ui/src/components/ViewSection';
import { ViewVisibilityMenu } from '../webview-ui/src/components/ViewVisibilityMenu';

const changes = (
  <ViewSection
    id="changes"
    title="Changes"
    count={3}
    visible
    collapsed={false}
    onCollapsedChange={() => undefined}
  >
    changes
  </ViewSection>
);

const first = (
  <ViewSection
    id="commits"
    title="Commits"
    count={12}
    visible
    collapsed={false}
    onCollapsedChange={() => undefined}
  >
    commit list
  </ViewSection>
);
const second = (
  <ViewSection
    id="files"
    title="Changed Files"
    visible
    collapsed={false}
    onCollapsedChange={() => undefined}
  >
    file list
  </ViewSection>
);
const details = (
  <ViewSection
    id="details"
    title="Commit Details"
    count={2}
    visible
    collapsed={false}
    onCollapsedChange={() => undefined}
  >
    commit details
  </ViewSection>
);
const stashes = (
  <ViewSection
    id="stashes"
    title="Stashes"
    count={2}
    visible
    collapsed={false}
    onCollapsedChange={() => undefined}
  >
    stashes
  </ViewSection>
);

const html = renderToStaticMarkup(
  <>
    {changes}
    <ResizableSplitView
      ratio={60}
      firstVisible
      firstCollapsed={false}
      secondVisible
      secondCollapsed={false}
      onRatioChange={() => undefined}
      first={first}
      second={second}
    />
    {stashes}
    {details}
    <ViewVisibilityMenu
      views={{
        changes: { visible: true, collapsed: false },
        commits: { visible: true, collapsed: false },
        stashes: { visible: true, collapsed: false },
        files: { visible: true, collapsed: false },
        details: { visible: true, collapsed: false },
      }}
      onVisibleChange={() => undefined}
    />
  </>
);

assert.match(html, /aria-label="CollapseCommits"/);
assert.match(html, /role="separator"/);
assert.match(html, /aria-orientation="horizontal"/);
assert.match(html, /title="Manage views"/);
assert.match(html, />Commits</);
assert.match(html, />Changes</);
assert.match(html, />Stashes</);
assert.match(html, />Changed Files</);
assert.match(html, />Commit Details</);
assert.match(html, /aria-label="CollapseCommit Details"/);

const zeroCountHtml = renderToStaticMarkup(
  <ViewSection
    id="empty"
    title="Empty"
    count={0}
    visible
    collapsed={false}
    onCollapsedChange={() => undefined}
  >
    empty
  </ViewSection>
);
assert.doesNotMatch(zeroCountHtml, /view-section-count/);

const collapsedHtml = renderToStaticMarkup(
  <ResizableSplitView
    ratio={60}
    firstVisible
    firstCollapsed
    secondVisible
    secondCollapsed={false}
    onRatioChange={() => undefined}
    first={
      <ViewSection
        id="commits"
        title="Commits"
        visible
        collapsed
        onCollapsedChange={() => undefined}
      >
        hidden commit content
      </ViewSection>
    }
    second={second}
  />
);
assert.doesNotMatch(collapsedHtml, /hidden commit content/);
assert.doesNotMatch(collapsedHtml, /role="separator"/);
assert.match(collapsedHtml, /aria-expanded="false"/);

const verticalHtml = renderToStaticMarkup(
  <ResizableSplitView
    orientation="vertical"
    ratio={70}
    firstVisible
    firstCollapsed={false}
    secondVisible
    secondCollapsed={false}
    onRatioChange={() => undefined}
    first={<div>main views</div>}
    second={details}
  />
);
assert.match(verticalHtml, /aria-orientation="horizontal"/);
assert.match(verticalHtml, /is-vertical/);

const hiddenHtml = renderToStaticMarkup(
  <ResizableSplitView
    ratio={60}
    firstVisible={false}
    firstCollapsed={false}
    secondVisible={false}
    secondCollapsed={false}
    onRatioChange={() => undefined}
    first={first}
    second={second}
  />
);
assert.equal(hiddenHtml, '', 'a split with no visible panels must not reserve space');

const collapsedGroupHtml = renderToStaticMarkup(
  <ResizableSplitView
    orientation="vertical"
    ratio={70}
    firstVisible
    firstCollapsed
    firstCollapsedSize={52}
    secondVisible
    secondCollapsed
    onRatioChange={() => undefined}
    first={<div>two collapsed views</div>}
    second={details}
  />
);
assert.match(collapsedGroupHtml, /--collapsed-pane-size:52px/);

const styles = readFileSync('webview-ui/src/styles.css', 'utf8');
assert.match(styles, /\.view-section-count\s*\{[^}]*margin-left:\s*auto/s);
assert.match(
  styles,
  /\.workbench-pane\s*\{[^}]*flex-direction:\s*column/s,
  'vertical panes must lay out collapsed sections as horizontal header rows'
);
assert.match(
  styles,
  /\.workbench-split\.is-second-collapsed\s*>\s*\.workbench-pane\.is-first\s*\{[^}]*flex:\s*1\s+1\s+auto/s,
  'the expanded pane must consume space released by a collapsed sibling'
);

const collapsedStackHtml = renderToStaticMarkup(
  <ResizablePanelStack
    panes={[
      { id: 'changes', visible: true, collapsed: true, content: changes },
      { id: 'commits', visible: true, collapsed: true, content: first },
      { id: 'stashes', visible: true, collapsed: true, content: stashes },
      { id: 'files', visible: true, collapsed: true, content: second },
      { id: 'details', visible: true, collapsed: true, content: details },
    ]}
    sizes={{ changes: 20, commits: 32, stashes: 16, files: 16, details: 16 }}
    onSizesChange={() => undefined}
  />
);
assert.equal((collapsedStackHtml.match(/data-stack-pane=/g) ?? []).length, 5);
assert.doesNotMatch(collapsedStackHtml, /role="separator"/);
assert.ok(
  collapsedStackHtml.indexOf('data-view-id="changes"') <
    collapsedStackHtml.indexOf('data-view-id="commits"') &&
    collapsedStackHtml.indexOf('data-view-id="commits"') <
      collapsedStackHtml.indexOf('data-view-id="stashes"') &&
    collapsedStackHtml.indexOf('data-view-id="stashes"') <
    collapsedStackHtml.indexOf('data-view-id="files"') &&
    collapsedStackHtml.indexOf('data-view-id="files"') <
      collapsedStackHtml.indexOf('data-view-id="details"'),
  'collapsed panes must remain same-level siblings in display order'
);

const resized = resizeAdjacentPaneSizes(
  { changes: 20, commits: 32, stashes: 16, files: 16, details: 16 },
  'commits',
  'files',
  50
);
assert.deepEqual(resized, { changes: 20, commits: 24, stashes: 16, files: 24, details: 16 });

console.log('workbench component checks passed');
