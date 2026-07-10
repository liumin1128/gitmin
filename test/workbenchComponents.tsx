import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResizableSplitView } from '../webview-ui/src/components/ResizableSplitView';
import { ViewSection } from '../webview-ui/src/components/ViewSection';
import { ViewVisibilityMenu } from '../webview-ui/src/components/ViewVisibilityMenu';

const first = (
  <ViewSection
    id="commits"
    title="提交"
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
    title="更改的文件"
    visible
    collapsed={false}
    onCollapsedChange={() => undefined}
  >
    file list
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
    <ViewVisibilityMenu
      commitsVisible
      filesVisible
      onCommitsVisibleChange={() => undefined}
      onFilesVisibleChange={() => undefined}
    />
  </>
);

assert.match(html, /aria-label="折叠提交"/);
assert.match(html, /role="separator"/);
assert.match(html, /aria-orientation="vertical"/);
assert.match(html, /title="管理视图"/);
assert.match(html, />提交</);
assert.match(html, />更改的文件</);

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
        title="提交"
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

console.log('workbench component checks passed');
