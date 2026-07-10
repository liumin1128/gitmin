# VS Code Workbench Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed commit/files split with a VS Code-native responsive workbench whose sections can be resized, collapsed, hidden, and restored across Webview sessions.

**Architecture:** Keep layout state independent from Git data. Pure utilities validate and update a versioned state object, a hook synchronizes it with the existing VS Code Webview API, and focused UI components render section headers, the responsive separator, and the visibility menu. `App` only connects layout state to the existing commit and file views.

**Tech Stack:** React 18, TypeScript, VS Code Webview API, CSS theme variables, Node assertions, esbuild.

---

## File Structure

- Create `webview-ui/src/utils/workbenchLayout.ts`: types, defaults, validation, clamping, and immutable transitions.
- Create `webview-ui/src/hooks/useWorkbenchLayout.ts`: React state and Webview persistence.
- Create `webview-ui/src/components/ViewSection.tsx`: accessible VS Code-style collapsible section.
- Create `webview-ui/src/components/ResizableSplitView.tsx`: responsive split and pointer/keyboard separator.
- Create `webview-ui/src/components/ViewVisibilityMenu.tsx`: checked visibility menu.
- Create `test/workbenchLayout.mts`: pure layout-state regression tests.
- Create `test/workbenchComponents.tsx`: server-rendered component structure checks.
- Modify `webview-ui/src/hooks/useIpc.ts`: expose typed Webview state accessors.
- Modify `webview-ui/src/components/FilterBar.tsx`: accept a trailing view action.
- Modify `webview-ui/src/components/ChangedFilesPanel.tsx`: remove the duplicate inner header.
- Modify `webview-ui/src/App.tsx`: compose the workbench without moving Git behavior.
- Modify `webview-ui/src/styles.css`: add native section, separator, visibility menu, and responsive layout styles.

### Task 1: Layout State and Persistence

**Files:**
- Create: `webview-ui/src/utils/workbenchLayout.ts`
- Create: `webview-ui/src/hooks/useWorkbenchLayout.ts`
- Create: `test/workbenchLayout.mts`
- Modify: `webview-ui/src/hooks/useIpc.ts`

- [ ] **Step 1: Write failing pure-state tests**

Create `test/workbenchLayout.mts`:

```ts
import assert from 'node:assert/strict';
import {
  DEFAULT_WORKBENCH_LAYOUT,
  clampSplitRatio,
  parseWorkbenchLayout,
  setViewCollapsed,
  setViewVisible,
} from '../webview-ui/src/utils/workbenchLayout.ts';

assert.equal(clampSplitRatio(5), 20);
assert.equal(clampSplitRatio(95), 80);
assert.equal(clampSplitRatio(62), 62);
assert.deepEqual(parseWorkbenchLayout(undefined), DEFAULT_WORKBENCH_LAYOUT);
assert.deepEqual(parseWorkbenchLayout({ version: 2 }), DEFAULT_WORKBENCH_LAYOUT);

const saved = {
  version: 1,
  splitRatio: 72,
  views: {
    commits: { visible: true, collapsed: false },
    files: { visible: false, collapsed: true },
  },
};
assert.deepEqual(parseWorkbenchLayout(saved), saved);
assert.equal(setViewVisible(saved, 'files', true).views.files.visible, true);
assert.equal(setViewCollapsed(saved, 'commits', true).views.commits.collapsed, true);
assert.equal(saved.views.files.visible, false, 'updates must be immutable');

console.log('workbench layout checks passed');
```

- [ ] **Step 2: Run the state test and verify it fails**

Run:

```bash
node --experimental-strip-types test/workbenchLayout.mts
```

Expected: failure because `workbenchLayout.ts` does not exist.

- [ ] **Step 3: Implement pure layout state**

Create `webview-ui/src/utils/workbenchLayout.ts` with this public contract:

```ts
export type WorkbenchViewId = 'commits' | 'files';
export interface WorkbenchViewState { visible: boolean; collapsed: boolean }
export interface WorkbenchLayoutState {
  version: 1;
  splitRatio: number;
  views: Record<WorkbenchViewId, WorkbenchViewState>;
}

export const DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayoutState = {
  version: 1,
  splitRatio: 60,
  views: {
    commits: { visible: true, collapsed: false },
    files: { visible: true, collapsed: false },
  },
};

export function clampSplitRatio(value: number): number {
  return Math.min(80, Math.max(20, Math.round(value)));
}

export function parseWorkbenchLayout(value: unknown): WorkbenchLayoutState;
export function setSplitRatio(state: WorkbenchLayoutState, ratio: number): WorkbenchLayoutState;
export function setViewVisible(state: WorkbenchLayoutState, id: WorkbenchViewId, visible: boolean): WorkbenchLayoutState;
export function setViewCollapsed(state: WorkbenchLayoutState, id: WorkbenchViewId, collapsed: boolean): WorkbenchLayoutState;
```

`parseWorkbenchLayout` must require version `1`, finite ratio, and boolean fields for both views; otherwise return a fresh default object. Every transition returns new nested objects and clamps the ratio.

- [ ] **Step 4: Expose Webview state access and add the persistence hook**

Add to `webview-ui/src/hooks/useIpc.ts`:

```ts
export function getWebviewState<T>(): T | undefined {
  return getApi().getState<T>();
}

export function setWebviewState<T>(state: T): void {
  getApi().setState(state);
}
```

Create `webview-ui/src/hooks/useWorkbenchLayout.ts`:

```ts
import { useCallback, useState } from 'react';
import { getWebviewState, setWebviewState } from './useIpc';
import {
  parseWorkbenchLayout,
  setSplitRatio,
  setViewCollapsed,
  setViewVisible,
  type WorkbenchLayoutState,
  type WorkbenchViewId,
} from '../utils/workbenchLayout';

interface PersistedWebviewState { workbenchLayout?: unknown }

export function useWorkbenchLayout() {
  const [layout, setLayout] = useState(() =>
    parseWorkbenchLayout(getWebviewState<PersistedWebviewState>()?.workbenchLayout)
  );
  const update = useCallback((next: WorkbenchLayoutState) => {
    setLayout(next);
    const current = getWebviewState<PersistedWebviewState>() ?? {};
    setWebviewState({ ...current, workbenchLayout: next });
  }, []);
  return {
    layout,
    setRatio: (ratio: number) => update(setSplitRatio(layout, ratio)),
    setVisible: (id: WorkbenchViewId, visible: boolean) => update(setViewVisible(layout, id, visible)),
    setCollapsed: (id: WorkbenchViewId, collapsed: boolean) => update(setViewCollapsed(layout, id, collapsed)),
  };
}
```

Use callbacks or functional state internally if needed to prevent stale updates while preserving this returned API.

- [ ] **Step 5: Verify state tests and type checking**

Run:

```bash
node --experimental-strip-types test/workbenchLayout.mts
npm run typecheck
```

Expected: `workbench layout checks passed` and both TypeScript projects pass.

### Task 2: Native Workbench Components

**Files:**
- Create: `webview-ui/src/components/ViewSection.tsx`
- Create: `webview-ui/src/components/ResizableSplitView.tsx`
- Create: `webview-ui/src/components/ViewVisibilityMenu.tsx`
- Create: `test/workbenchComponents.tsx`

- [ ] **Step 1: Write a failing component structure test**

Create `test/workbenchComponents.tsx` using `renderToStaticMarkup`. Render two `ViewSection` elements inside `ResizableSplitView`, plus `ViewVisibilityMenu`, and assert:

```tsx
assert.match(html, /aria-label="折叠提交"/);
assert.match(html, /role="separator"/);
assert.match(html, /aria-orientation="vertical"/);
assert.match(html, /title="管理视图"/);
assert.match(html, />提交</);
assert.match(html, />更改的文件</);
```

Supply no-op callbacks and a layout where both views are visible and expanded. Print `workbench component checks passed` on success.

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```bash
./node_modules/.bin/esbuild test/workbenchComponents.tsx --bundle --platform=node --format=cjs --jsx=automatic --define:process.env.NODE_ENV='"production"' --outfile=/tmp/git-management-workbench-components.cjs && node /tmp/git-management-workbench-components.cjs
```

Expected: bundle failure because the three components do not exist.

- [ ] **Step 3: Implement `ViewSection`**

Use this interface:

```tsx
interface Props {
  id: string;
  title: string;
  count?: number;
  visible: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  actions?: ReactNode;
  children: ReactNode;
}
```

Return `null` when hidden. Otherwise render `.view-section`, a button-based `.view-section-header` with `aria-expanded`, an accessible label such as `折叠提交` or `展开提交`, count and actions, then render `.view-section-content` only while expanded. Action clicks must not toggle the section.

- [ ] **Step 4: Implement `ResizableSplitView`**

Use this interface:

```tsx
interface Props {
  ratio: number;
  firstVisible: boolean;
  firstCollapsed: boolean;
  secondVisible: boolean;
  secondCollapsed: boolean;
  onRatioChange: (ratio: number) => void;
  first: ReactNode;
  second: ReactNode;
}
```

Render a `.workbench-split` with CSS variable `--split-ratio`. Render the separator only when both sections are visible and expanded:

```tsx
<div
  className="workbench-separator"
  role="separator"
  aria-label="调整板块大小"
  aria-orientation="vertical"
  aria-valuemin={20}
  aria-valuemax={80}
  aria-valuenow={ratio}
  tabIndex={0}
/>
```

Pointer movement calculates a horizontal ratio at widths `>= 700px` and a vertical ratio below that breakpoint. Arrow keys adjust by two percentage points. The component must register temporary window listeners during dragging and remove them on pointer release/unmount.

- [ ] **Step 5: Implement `ViewVisibilityMenu`**

Reuse `FilterDropdown` with `label="⋯"`, `title="管理视图"`, `hideCaret`, and right-aligned menu styling. Use checked checkboxes for `提交` and `更改的文件` and this interface:

```tsx
interface Props {
  commitsVisible: boolean;
  filesVisible: boolean;
  onCommitsVisibleChange: (visible: boolean) => void;
  onFilesVisibleChange: (visible: boolean) => void;
}
```

- [ ] **Step 6: Verify component tests and type checking**

Run the component bundle command from Step 2, then `npm run typecheck`.

Expected: `workbench component checks passed`; both TypeScript projects pass.

### Task 3: Integrate and Style the Workbench

**Files:**
- Modify: `webview-ui/src/components/FilterBar.tsx`
- Modify: `webview-ui/src/components/ChangedFilesPanel.tsx`
- Modify: `webview-ui/src/App.tsx`
- Modify: `webview-ui/src/styles.css`

- [ ] **Step 1: Add a trailing toolbar action slot**

Add `actions?: ReactNode` to `FilterBar` and render it after `ColumnsMenu`. Keep refresh and column settings behavior unchanged:

```tsx
<ColumnsMenu columns={columns} onChange={onColumnsChange} />
{actions}
```

- [ ] **Step 2: Remove the duplicate changed-files header**

In `ChangedFilesPanel`, remove `.files-header`; return `.files-panel` containing only `.files-list`. The outer `ViewSection` will display file count and the non-contiguous warning through its `actions` slot.

- [ ] **Step 3: Compose layout in `App`**

Initialize `useWorkbenchLayout`, pass `ViewVisibilityMenu` as the filter-bar action, and replace `.split` with:

```tsx
<ResizableSplitView
  ratio={layout.splitRatio}
  firstVisible={layout.views.commits.visible}
  firstCollapsed={layout.views.commits.collapsed}
  secondVisible={layout.views.files.visible}
  secondCollapsed={layout.views.files.collapsed}
  onRatioChange={setRatio}
  first={
    <ViewSection
      id="commits"
      title="提交"
      count={commits.length}
      visible={layout.views.commits.visible}
      collapsed={layout.views.commits.collapsed}
      onCollapsedChange={(value) => setCollapsed('commits', value)}
    >
      <CommitList {...existingCommitListProps} />
    </ViewSection>
  }
  second={
    <ViewSection
      id="files"
      title="更改的文件"
      count={range ? files.length : undefined}
      visible={layout.views.files.visible}
      collapsed={layout.views.files.collapsed}
      onCollapsedChange={(value) => setCollapsed('files', value)}
      actions={range && !range.contiguous ? <span className="warn-tag" title="选中的 commit 不连续">⚠</span> : undefined}
    >
      <ChangedFilesPanel {...existingChangedFilesProps} />
    </ViewSection>
  }
/>
```

Use the existing explicit props rather than object spreads in production code.

- [ ] **Step 4: Replace fixed split CSS with VS Code-native workbench CSS**

Remove `.split`, `.split-left`, `.split-right`, and `.files-header`. Add styles with these required behaviors:

```css
.workbench-split { display:flex; flex:1; min-height:0; flex-direction:column; }
.view-section { display:flex; flex-direction:column; min-width:0; min-height:0; overflow:hidden; }
.view-section-header { height:26px; flex:0 0 26px; border:0; border-bottom:1px solid var(--vscode-panel-border); background:var(--vscode-sideBarSectionHeader-background); color:var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground)); }
.view-section-content { flex:1; min-width:0; min-height:0; overflow:auto; }
.workbench-separator { flex:0 0 4px; background:var(--vscode-panel-border); cursor:row-resize; }
.workbench-separator:hover, .workbench-separator:focus-visible { background:var(--vscode-sash-hoverBorder, var(--vscode-focusBorder)); }
@media (min-width:700px) {
  .workbench-split { flex-direction:row; }
  .workbench-separator { cursor:col-resize; }
}
```

Apply `--split-ratio` to the first expanded section, shrink collapsed sections to the 26 px header dimension, let a sole visible/expanded section fill remaining space, and ensure long titles/counts truncate rather than overlap. Use only VS Code theme variables with neutral fallbacks.

- [ ] **Step 5: Run all automated verification**

Run:

```bash
node --experimental-strip-types test/workbenchLayout.mts
./node_modules/.bin/esbuild test/workbenchComponents.tsx --bundle --platform=node --format=cjs --jsx=automatic --define:process.env.NODE_ENV='"production"' --outfile=/tmp/git-management-workbench-components.cjs && node /tmp/git-management-workbench-components.cjs
./node_modules/.bin/esbuild test/refreshToolbar.tsx --bundle --platform=node --format=cjs --jsx=automatic --define:process.env.NODE_ENV='"production"' --outfile=/tmp/git-management-refresh-toolbar-test.cjs && node /tmp/git-management-refresh-toolbar-test.cjs
npm run typecheck
node --experimental-strip-types test/sanity.mts
npm run build
git diff --check
```

Expected: all three test scripts pass, both TypeScript projects pass, sanity checks pass, build completes, and diff check is silent.

- [ ] **Step 6: Perform visual verification**

Open the built Webview with a temporary HTML harness that stubs `acquireVsCodeApi`, then inspect screenshots at approximately `1000x700` and `420x700`.

Verify:

- Wide view uses side-by-side sections and a vertical separator.
- Narrow view stacks sections and uses a horizontal separator.
- Headers, menu, hover/focus states, long text, and empty states do not overlap.
- Collapsing, hiding, restoring, pointer resizing, and keyboard resizing work.
- Reloading restores ratio, visibility, and collapsed state.

- [ ] **Step 7: Commit the implementation only after user approval**

Do not commit automatically. Leave verified changes in the current working tree unless the user requests a commit.
