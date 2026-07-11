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

const html = renderToStaticMarkup(
  <>
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
    {details}
    <ViewVisibilityMenu
      commitsVisible
      filesVisible
      detailsVisible
      onCommitsVisibleChange={() => undefined}
      onFilesVisibleChange={() => undefined}
      onDetailsVisibleChange={() => undefined}
    />
  </>
);

assert.match(html, /aria-label="CollapseCommits"/);
assert.match(html, /role="separator"/);
assert.match(html, /aria-orientation="horizontal"/);
assert.match(html, /title="Manage views"/);
assert.match(html, />Commits</);
assert.match(html, />Changed Files</);
assert.match(html, />Commit Details</);
assert.match(html, /aria-label="CollapseCommit Details"/);

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
      { id: 'commits', visible: true, collapsed: true, content: first },
      { id: 'files', visible: true, collapsed: true, content: second },
      { id: 'details', visible: true, collapsed: true, content: details },
    ]}
    sizes={{ commits: 42, files: 28, details: 30 }}
    onSizesChange={() => undefined}
  />
);
assert.equal((collapsedStackHtml.match(/data-stack-pane=/g) ?? []).length, 3);
assert.doesNotMatch(collapsedStackHtml, /role="separator"/);
assert.ok(
  collapsedStackHtml.indexOf('data-view-id="commits"') <
    collapsedStackHtml.indexOf('data-view-id="files"') &&
    collapsedStackHtml.indexOf('data-view-id="files"') <
      collapsedStackHtml.indexOf('data-view-id="details"'),
  'collapsed panes must remain same-level siblings in display order'
);

const resized = resizeAdjacentPaneSizes(
  { commits: 42, files: 28, details: 30 },
  'commits',
  'files',
  50
);
assert.deepEqual(resized, { commits: 35, files: 35, details: 30 });

console.log('workbench component checks passed');
