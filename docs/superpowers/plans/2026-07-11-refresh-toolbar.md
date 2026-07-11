# Refresh Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the standalone repository title row and expose the existing refresh action as an icon button in the filter toolbar.

**Architecture:** Keep refresh orchestration in `App`, where selection and IPC state already live. Extend `FilterBar` with a presentation-only `onRefresh` callback, render the control beside `ColumnsMenu`, and remove the now-unused `Toolbar` component and styles.

**Tech Stack:** React 18, TypeScript, CSS using VS Code theme variables, Node assertions, esbuild.

---

## File Structure

- Create `test/refreshToolbar.tsx`: server-rendered component regression test for toolbar placement and accessible labeling.
- Modify `webview-ui/src/components/FilterBar.tsx`: accept and render the refresh action.
- Modify `webview-ui/src/App.tsx`: remove `Toolbar` and pass `handleRefresh` to `FilterBar`.
- Modify `webview-ui/src/styles.css`: remove obsolete title-row styles and add icon-button styling.
- Delete `webview-ui/src/components/Toolbar.tsx`: remove the obsolete standalone title UI.

### Task 1: Move Refresh Into Filter Bar

**Files:**
- Create: `test/refreshToolbar.tsx`
- Modify: `webview-ui/src/components/FilterBar.tsx`
- Modify: `webview-ui/src/App.tsx`
- Modify: `webview-ui/src/styles.css`
- Delete: `webview-ui/src/components/Toolbar.tsx`

- [ ] **Step 1: Write the failing component test**

Create `test/refreshToolbar.tsx` with a server-rendered `FilterBar`. Pass `onRefresh` through an intentionally widened test prop object so the current component still compiles, then assert that the missing control causes a behavioral failure:

```tsx
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { FilterBar } from '../webview-ui/src/components/FilterBar';
import { DEFAULT_COLUMNS } from '../webview-ui/src/components/CommitList';

const props = {
  filters: {},
  options: { branches: [], authors: [] },
  onChange: () => undefined,
  columns: DEFAULT_COLUMNS,
  onColumnsChange: () => undefined,
  onRefresh: () => undefined,
};

const html = renderToStaticMarkup(<FilterBar {...props} />);
const refreshIndex = html.indexOf('aria-label="Refresh commit list"');
const columnsIndex = html.indexOf('title="Display columns"');

assert.notEqual(refreshIndex, -1, 'filter toolbar should render refresh action');
assert.notEqual(columnsIndex, -1, 'filter toolbar should retain column settings');
assert.ok(refreshIndex < columnsIndex, 'refresh action should appear before column settings');
console.log('refresh toolbar checks passed');
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run:

```bash
./node_modules/.bin/esbuild test/refreshToolbar.tsx --bundle --platform=node --format=cjs --jsx=automatic --define:process.env.NODE_ENV='"production"' --outfile=/tmp/git-management-refresh-toolbar-test.cjs && node /tmp/git-management-refresh-toolbar-test.cjs
```

Expected: the bundle succeeds and Node fails with `filter toolbar should render refresh action`.

- [ ] **Step 3: Add refresh to `FilterBar`**

Add the callback to `Props` and the component parameters:

```tsx
interface Props {
  filters: CommitFilters;
  options: FilterOptions;
  onChange: (next: CommitFilters) => void;
  columns: ColumnFlags;
  onColumnsChange: (next: ColumnFlags) => void;
  onRefresh: () => void;
}

export function FilterBar({
  filters,
  options,
  onChange,
  columns,
  onColumnsChange,
  onRefresh,
}: Props) {
```

Render the icon action after the spacer and immediately before `ColumnsMenu`:

```tsx
<button
  type="button"
  className="toolbar-icon-button"
  onClick={onRefresh}
  title="Refresh commit list"
  aria-label="Refresh commit list"
>
  ↻
</button>
<ColumnsMenu columns={columns} onChange={onColumnsChange} />
```

- [ ] **Step 4: Remove the standalone title row from `App`**

Delete the `Toolbar` import and render call. Remove the unused `repo` state and `RepoInfo` type import; the repository listeners only need to clear or set `repoError`. Pass the existing handler into `FilterBar`:

```tsx
<FilterBar
  filters={filters}
  options={filterOptions}
  onChange={setFilters}
  columns={columns}
  onColumnsChange={setColumns}
  onRefresh={handleRefresh}
/>
```

Update the repository listeners to avoid retaining display-only state:

```tsx
useIpcListener('repo/info', () => {
  setRepoError(null);
});
useIpcListener('repo/none', (m) => {
  setRepoError(m.reason);
});
```

Delete `webview-ui/src/components/Toolbar.tsx` after its final consumer is removed.

- [ ] **Step 5: Replace obsolete title styles with icon-button styles**

Remove `.toolbar`, `.toolbar-repo`, `.repo-branch`, `.repo-path`, `.toolbar-actions`, and `.selected-count`. Keep the shared `.btn` rules used by the date panel. Add:

```css
.toolbar-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 2px;
  background: transparent;
  color: var(--vscode-foreground);
  font: inherit;
  cursor: pointer;
}
.toolbar-icon-button:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.2));
}
.toolbar-icon-button:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: -1px;
}
```

- [ ] **Step 6: Verify the component test passes**

Run:

```bash
./node_modules/.bin/esbuild test/refreshToolbar.tsx --bundle --platform=node --format=cjs --jsx=automatic --define:process.env.NODE_ENV='"production"' --outfile=/tmp/git-management-refresh-toolbar-test.cjs && node /tmp/git-management-refresh-toolbar-test.cjs
```

Expected: `refresh toolbar checks passed`.

- [ ] **Step 7: Run project verification**

Run:

```bash
npm run typecheck
node --experimental-strip-types test/sanity.mts
npm run build
git diff --check
```

Expected: both TypeScript projects type-check, sanity checks print `all sanity checks passed`, esbuild prints `build complete`, and `git diff --check` is silent.

- [ ] **Step 8: Commit the implementation**

```bash
git add test/refreshToolbar.tsx webview-ui/src/components/FilterBar.tsx webview-ui/src/App.tsx webview-ui/src/styles.css webview-ui/src/components/Toolbar.tsx
git commit -m "feat: move refresh into filter toolbar"
```
