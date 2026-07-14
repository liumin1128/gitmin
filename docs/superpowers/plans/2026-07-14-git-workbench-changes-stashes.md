# Git Workbench Changes and Stashes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Changes and Stashes as first-class GitMin workbench sections while moving commit filters into Commits and reusing the existing file/detail sections for commit or stash inspection.

**Architecture:** Keep one React webview and expand the existing resizable workbench to five sibling sections. Add focused working-tree and stash services in the extension host, typed request-ID-based IPC, UI hooks for business state, and render-only React components. Continue using `simple-git` for Git operations and the built-in VS Code Git API only for repository notifications and diff URIs.

**Tech Stack:** TypeScript, React 18, VS Code Extension API, `simple-git`, esbuild, Node assertion scripts

---

## File Map

**Create:**

- `shared/workingTree.ts`: working-tree action types and pure action guards.
- `src/utils/workingTreeStatus.ts`: pure `simple-git` status conversion.
- `src/utils/stashParser.ts`: pure parser for NUL/record-separated stash output.
- `src/utils/workingTreeDiff.ts`: pure diff endpoint selection.
- `src/services/WorkingTreeService.ts`: status, stage, unstage, discard, commit, and stash operations.
- `src/services/StashService.ts`: list, inspect, apply, and safely delete stashes.
- `src/services/WorkingTreeDiffNavigator.ts`: open index/worktree/merge diffs.
- `webview-ui/src/hooks/useWorkingTree.ts`: Changes IPC and UI state.
- `webview-ui/src/hooks/useStashes.ts`: stash list, selection, action, and IPC state.
- `webview-ui/src/hooks/useSelectionDetails.ts`: unified commit/stash details requests.
- `webview-ui/src/components/ChangesPanel.tsx`: commit input and working-tree groups.
- `webview-ui/src/components/ChangeGroup.tsx`: render one change group and file actions.
- `webview-ui/src/components/StashList.tsx`: render stash rows and toolbar actions.
- `webview-ui/src/components/WorkbenchToolbar.tsx`: always-accessible view visibility control.
- `webview-ui/src/utils/detailSelection.ts`: pure mutually-exclusive selection helpers.
- `test/workingTree.mts`: working-tree parser and guard tests.
- `test/stashParser.mts`: stash parser tests.
- `test/gitWorkspaceServices.mts`: temporary-repository service integration tests.
- `test/workingTreeDiff.mts`: diff endpoint tests.
- `test/workbenchChanges.tsx`: Changes/Stashes/component structure tests.
- `test/detailSelection.mts`: selection transition tests.

**Modify:**

- `shared/domain.ts`: working-tree, stash, and detail-selection domain types.
- `shared/messages.ts`: typed Changes, Stashes, and unified detail IPC.
- `src/ipc/MessageHandler.ts`: route new messages and coordinate refreshes.
- `src/services/RepoLocator.ts`: expose minimal repository state-change API.
- `src/panels/GitPanelProvider.ts`: no behavior change; disposal remains owned by `MessageHandler`.
- `src/panels/GitPanelViewProvider.ts`: no behavior change; disposal remains owned by `MessageHandler`.
- `webview-ui/src/App.tsx`: compose five sections and coordinate selection.
- `webview-ui/src/utils/workbenchLayout.ts`: version-2 five-pane persisted layout.
- `webview-ui/src/hooks/useWorkbenchLayout.ts`: persist direct pane sizes.
- `webview-ui/src/components/ViewVisibilityMenu.tsx`: manage all five sections.
- `webview-ui/src/styles.css`: Changes, Stashes, global toolbar, and responsive styling.
- `test/workbenchLayout.mts`: version-1 migration and five-pane sizing.
- `test/workbenchComponents.tsx`: five-section visibility menu and order.
- `package.json`: focused test scripts.

**Remove after replacement:**

- `webview-ui/src/hooks/useCommitDetails.ts`: superseded by `useSelectionDetails`.

---

### Task 1: Persist a Five-Pane Workbench Layout

**Files:**
- Modify: `webview-ui/src/utils/workbenchLayout.ts`
- Modify: `webview-ui/src/hooks/useWorkbenchLayout.ts`
- Modify: `webview-ui/src/App.tsx`
- Modify: `test/workbenchLayout.mts`

- [ ] **Step 1: Write the failing version-2 layout tests**

Replace the specialized three-pane expectations in `test/workbenchLayout.mts` with assertions for five view IDs, direct sizes, and version-1 migration:

```ts
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
  'changes', 'commits', 'stashes', 'files', 'details',
]);
assert.equal(Object.values(DEFAULT_WORKBENCH_LAYOUT.sizes).reduce((a, b) => a + b, 0), 100);

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
  changes: 20, commits: 32, stashes: 16, files: 16, details: 16,
});
assert.deepEqual(resized.sizes, {
  changes: 20, commits: 32, stashes: 16, files: 16, details: 16,
});
assert.notEqual(resized, migrated);

console.log('workbench layout checks passed');
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --experimental-strip-types test/workbenchLayout.mts`

Expected: FAIL because `changes`, `stashes`, and `sizes` do not exist.

- [ ] **Step 3: Implement version-2 direct pane sizes**

Change `workbenchLayout.ts` to use this public shape and preserve version-1 visibility/collapse state during migration:

```ts
export const WORKBENCH_VIEW_IDS = [
  'changes', 'commits', 'stashes', 'files', 'details',
] as const;
export type WorkbenchViewId = (typeof WORKBENCH_VIEW_IDS)[number];
export interface WorkbenchViewState { visible: boolean; collapsed: boolean }
export type WorkbenchPaneSizes = Record<WorkbenchViewId, number>;
export interface WorkbenchLayoutState {
  version: 2;
  sizes: WorkbenchPaneSizes;
  views: Record<WorkbenchViewId, WorkbenchViewState>;
}

export const DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayoutState = {
  version: 2,
  sizes: { changes: 20, commits: 32, stashes: 16, files: 16, details: 16 },
  views: {
    changes: { visible: true, collapsed: false },
    commits: { visible: true, collapsed: false },
    stashes: { visible: true, collapsed: false },
    files: { visible: true, collapsed: false },
    details: { visible: true, collapsed: false },
  },
};
```

Implement `parseWorkbenchLayout` with two explicit branches: validate and clone version 2; map version-1 `commits/files/details` state onto the version-2 defaults. Implement `setWorkbenchPaneSizes` as an immutable update after validating every size is finite and positive. Remove obsolete split-ratio functions.

Update `useWorkbenchLayout` so `setPaneSizes` persists `state.sizes` directly and remove unused `setRatio` and `setDetailsRatio` callbacks. In `App.tsx`, replace `getWorkbenchPaneSizes(layout)` with `layout.sizes` and remove that utility import so the repository typechecks at the end of this task.

- [ ] **Step 4: Run the layout test and typecheck**

Run: `node --experimental-strip-types test/workbenchLayout.mts && npm run typecheck`

Expected: layout test and both TypeScript projects PASS.

- [ ] **Step 5: Commit**

```bash
git add webview-ui/src/utils/workbenchLayout.ts webview-ui/src/hooks/useWorkbenchLayout.ts webview-ui/src/App.tsx test/workbenchLayout.mts
git commit -m "refactor: support five workbench panes"
```

---

### Task 2: Define Working-Tree and Stash Domain Parsing

**Files:**
- Modify: `shared/domain.ts`
- Create: `shared/workingTree.ts`
- Create: `src/utils/workingTreeStatus.ts`
- Create: `src/utils/stashParser.ts`
- Create: `test/workingTree.mts`
- Create: `test/stashParser.mts`

- [ ] **Step 1: Write failing parser and action-guard tests**

Create `test/workingTree.mts`:

```ts
import assert from 'node:assert/strict';
import { toWorkingTreeSnapshot } from '../src/utils/workingTreeStatus.ts';
import { canCommit, canStash } from '../shared/workingTree.ts';

const snapshot = toWorkingTreeSnapshot([
  { path: 'both.ts', index: 'M', working_dir: 'M' },
  { path: 'new.ts', index: '?', working_dir: '?' },
  { path: 'conflict.ts', index: 'U', working_dir: 'U' },
  { path: 'renamed.ts', from: 'old.ts', index: 'R', working_dir: ' ' },
]);

assert.deepEqual(snapshot.staged.map((f) => f.path), ['both.ts', 'renamed.ts']);
assert.deepEqual(snapshot.changes.map((f) => f.path), ['both.ts', 'new.ts']);
assert.deepEqual(snapshot.conflicts.map((f) => f.path), ['conflict.ts']);
assert.equal(snapshot.staged[1]?.oldPath, 'old.ts');
assert.equal(canCommit('message', snapshot), true);
assert.equal(canCommit('   ', snapshot), false);
assert.equal(canCommit('message', { conflicts: [], staged: [], changes: [] }), false);
assert.equal(canStash(snapshot), true);

console.log('working tree checks passed');
```

Create `test/stashParser.mts`:

```ts
import assert from 'node:assert/strict';
import { parseStashList } from '../src/utils/stashParser.ts';

const raw = [
  ['stash@{0}', 'abc123', 'parent0 index0', '2026-07-14T10:00:00+08:00', 'On main: checkpoint'].join('\0'),
  ['stash@{1}', 'def456', 'parent1 index1', '2026-07-13T10:00:00+08:00', 'WIP on main: 123 subject'].join('\0'),
].join('\x1e');
const entries = parseStashList(raw);

assert.equal(entries.length, 2);
assert.deepEqual(entries[0], {
  selector: 'stash@{0}',
  hash: 'abc123',
  parentHash: 'parent0',
  message: 'On main: checkpoint',
  date: '2026-07-14T10:00:00+08:00',
});
assert.deepEqual(parseStashList(''), []);

console.log('stash parser checks passed');
```

- [ ] **Step 2: Run both tests and verify RED**

Run: `node --experimental-strip-types test/workingTree.mts && node --experimental-strip-types test/stashParser.mts`

Expected: FAIL with missing module/export errors.

- [ ] **Step 3: Add domain types and pure guards**

Extend `FileStatus` with `'T'` and add to `shared/domain.ts`:

```ts
export type WorkingTreeGroup = 'conflicts' | 'staged' | 'changes';
export interface WorkingTreeChange {
  path: string;
  oldPath?: string;
  status: FileStatus;
  group: WorkingTreeGroup;
}
export interface WorkingTreeSnapshot {
  conflicts: WorkingTreeChange[];
  staged: WorkingTreeChange[];
  changes: WorkingTreeChange[];
}
export interface StashEntry {
  selector: string;
  hash: string;
  parentHash: string;
  message: string;
  date: string;
}
export type DetailSelection =
  | { kind: 'commits'; hashes: string[] }
  | { kind: 'stash'; selector: string; hash: string };
```

Create `shared/workingTree.ts`:

```ts
import type { WorkingTreeSnapshot } from './domain';

export type WorkingTreeAction = 'stage' | 'unstage' | 'discard';
export function canCommit(message: string, snapshot: WorkingTreeSnapshot): boolean {
  return message.trim().length > 0 && snapshot.staged.length > 0;
}
export function canStash(snapshot: WorkingTreeSnapshot): boolean {
  return snapshot.conflicts.length + snapshot.staged.length + snapshot.changes.length > 0;
}
```

- [ ] **Step 4: Implement deterministic parsers**

In `workingTreeStatus.ts`, define a small input interface matching the `simple-git` file fields, classify conflict pairs `DD/AU/UD/UA/DU/AA/UU`, emit both staged and unstaged entries for files changed in both places, map `?` to untracked, and sort each group by path. Do not mutate the input.

In `stashParser.ts`, split records by `\x1e`, split fields by `\0`, require five non-empty fields except message, and use the first parent from `%P` as `parentHash`. Ignore malformed records rather than returning partial entries.

Use this stash format constant:

```ts
export const STASH_LIST_FORMAT = '%gd%x00%H%x00%P%x00%aI%x00%gs%x1e';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `node --experimental-strip-types test/workingTree.mts && node --experimental-strip-types test/stashParser.mts && npm run typecheck`

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/domain.ts shared/workingTree.ts src/utils/workingTreeStatus.ts src/utils/stashParser.ts test/workingTree.mts test/stashParser.mts
git commit -m "feat: model working tree and stash state"
```

---

### Task 3: Implement Git Workspace Services

**Files:**
- Create: `src/services/WorkingTreeService.ts`
- Create: `src/services/StashService.ts`
- Create: `test/gitWorkspaceServices.mts`
- Modify: `package.json`

- [ ] **Step 1: Write a failing temporary-repository integration test**

Create `test/gitWorkspaceServices.mts` using `mkdtemp`, `writeFile`, `rm`, and `simpleGit`. Initialize a repository, configure a local test identity, create an initial commit, then assert this sequence:

```ts
const workingTree = new WorkingTreeService(root);
const stashes = new StashService(root, new GitService(root));

await writeFile(join(root, 'tracked.txt'), 'changed\n');
await writeFile(join(root, 'untracked.txt'), 'new\n');
let snapshot = await workingTree.getSnapshot();
assert.deepEqual(snapshot.changes.map((f) => f.path), ['tracked.txt', 'untracked.txt']);

await workingTree.stage(['tracked.txt']);
snapshot = await workingTree.getSnapshot();
assert.deepEqual(snapshot.staged.map((f) => f.path), ['tracked.txt']);

await workingTree.unstage(['tracked.txt']);
assert.equal((await workingTree.getSnapshot()).staged.length, 0);

await workingTree.stage(['tracked.txt']);
await workingTree.commit('service commit');
assert.equal((await git.log({ maxCount: 1 })).latest?.message, 'service commit');

await writeFile(join(root, 'tracked.txt'), 'stash me\n');
await workingTree.createStash('checkpoint');
let list = await stashes.listRecent(10);
assert.equal(list.length, 1);
assert.match(list[0]!.message, /checkpoint/);

await stashes.apply(list[0]!.hash);
assert.equal(await readFile(join(root, 'tracked.txt'), 'utf8'), 'stash me\n');
assert.equal((await stashes.listRecent(10)).length, 1, 'apply must not drop');

await stashes.deleteVerified(list[0]!);
assert.equal((await stashes.listRecent(10)).length, 0);
```

Add separate assertions that `discard('changes', ['tracked.txt', 'untracked.txt'])` restores the tracked file and deletes the untracked file. Always remove the temporary directory in `finally`.

- [ ] **Step 2: Run the service test and verify RED**

Run: `node --experimental-strip-types test/gitWorkspaceServices.mts`

Expected: FAIL because both services are missing.

- [ ] **Step 3: Implement `WorkingTreeService`**

Use one `SimpleGit` instance and expose these exact methods:

```ts
export class WorkingTreeService {
  constructor(rootPath: string);
  getSnapshot(): Promise<WorkingTreeSnapshot>;
  stage(paths: string[]): Promise<void>;
  unstage(paths: string[]): Promise<void>;
  discard(group: WorkingTreeGroup, paths: string[]): Promise<void>;
  commit(message: string): Promise<void>;
  createStash(message: string): Promise<string>;
}
```

Implementation rules:

- `stage`: `git add -- <paths>`.
- `unstage`: `git reset HEAD -- <paths>` so working-tree content is preserved.
- `commit`: trim validation, re-read status, reject no staged files, then `git commit -m <original message>`.
- `createStash`: `git stash push -m <trimmed message>` when non-empty, otherwise `git stash`.
- `discard('changes', ...)`: re-read snapshot, partition untracked paths to `git clean -fd --`, restore tracked paths with `git restore --worktree --`.
- `discard('staged', ...)`: `git restore --source=HEAD --staged --worktree --`.
- `discard('conflicts', ...)`: `git restore --source=HEAD --staged --worktree --`.
- Return immediately for an empty path list.

- [ ] **Step 4: Implement `StashService`**

Expose:

```ts
export interface StashDetails {
  entry: StashEntry;
  range: DiffRange;
  files: FileChange[];
  details: CommitDetails[];
}
export class StashService {
  constructor(rootPath: string, gitService: GitService);
  listRecent(limit?: number): Promise<StashEntry[]>;
  getDetails(entry: StashEntry): Promise<StashDetails>;
  apply(hash: string): Promise<void>;
  deleteVerified(entry: StashEntry): Promise<void>;
}
```

`listRecent` runs `git stash list -n <limit> --format=<STASH_LIST_FORMAT>` and clamps limit to `1..100`. `getDetails` verifies `git rev-parse <selector>` still equals `entry.hash`, then requests `parentHash..hash` from `GitService`. `apply` uses the stable hash. `deleteVerified` repeats the selector/hash verification immediately before `git stash drop <selector>`.

- [ ] **Step 5: Run service tests and typecheck**

Run: `node --experimental-strip-types test/gitWorkspaceServices.mts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Add focused scripts and commit**

Add:

```json
"test:working-tree": "node --experimental-strip-types test/workingTree.mts && node --experimental-strip-types test/gitWorkspaceServices.mts",
"test:stashes": "node --experimental-strip-types test/stashParser.mts"
```

Then commit:

```bash
git add src/services/WorkingTreeService.ts src/services/StashService.ts test/gitWorkspaceServices.mts package.json
git commit -m "feat: add working tree and stash services"
```

---

### Task 4: Add Typed IPC and Unified Selection Details

**Files:**
- Modify: `shared/messages.ts`
- Modify: `src/ipc/MessageHandler.ts`
- Create: `webview-ui/src/utils/detailSelection.ts`
- Create: `test/detailSelection.mts`

- [ ] **Step 1: Write failing selection and stale-response tests**

Create `test/detailSelection.mts`:

```ts
import assert from 'node:assert/strict';
import {
  commitSelection,
  stashSelection,
  acceptsResponse,
} from '../webview-ui/src/utils/detailSelection.ts';

assert.deepEqual(commitSelection(['b', 'a']), { kind: 'commits', hashes: ['a', 'b'] });
assert.deepEqual(stashSelection({ selector: 'stash@{0}', hash: 'abc' }), {
  kind: 'stash', selector: 'stash@{0}', hash: 'abc',
});
assert.equal(acceptsResponse(4, 4), true);
assert.equal(acceptsResponse(3, 4), false);

console.log('detail selection checks passed');
```

- [ ] **Step 2: Run the selection test and verify RED**

Run: `node --experimental-strip-types test/detailSelection.mts`

Expected: FAIL because `detailSelection.ts` is missing.

- [ ] **Step 3: Implement selection helpers and IPC unions**

Implement the three pure helpers exactly as exercised above.

Replace separate commit-detail/diff requests with unified detail messages and add working-tree/stash messages in `shared/messages.ts`. Define `RefreshTarget` as `'changes' | 'commits' | 'stashes'` and `GitWorkspaceOperation` as `'stage' | 'unstage' | 'discard' | 'commit' | 'stash' | 'apply-stash' | 'delete-stash'`:

```ts
| { type: 'workingTree/request'; requestId: number }
| { type: 'workingTree/action'; requestId: number; action: WorkingTreeAction; group: WorkingTreeGroup; paths: string[] }
| { type: 'workingTree/commit'; requestId: number; message: string }
| { type: 'workingTree/stash'; requestId: number; message: string }
| { type: 'workingTree/openDiff'; group: WorkingTreeGroup; path: string }
| { type: 'stashes/request'; requestId: number }
| { type: 'stashes/action'; requestId: number; action: 'apply' | 'delete'; selector: string; hash: string }
| { type: 'selectionDetails/request'; requestId: number; selection: DetailSelection }
```

Extension responses:

```ts
| { type: 'workingTree/loaded'; requestId: number; snapshot: WorkingTreeSnapshot }
| { type: 'workingTree/error'; requestId: number; error: string }
| { type: 'workingTree/changed' }
| { type: 'workingTree/actionResult'; requestId: number; operation: GitWorkspaceOperation; ok: boolean; message?: string; refresh: RefreshTarget[] }
| { type: 'stashes/loaded'; requestId: number; entries: StashEntry[] }
| { type: 'stashes/error'; requestId: number; error: string }
| { type: 'selectionDetails/loaded'; requestId: number; selection: DetailSelection; range: DiffRange; files: FileChange[]; details: CommitDetails[] }
| { type: 'selectionDetails/error'; requestId: number; selection: DetailSelection; error: string }
```

- [ ] **Step 4: Route IPC through focused private methods**

In `MessageHandler`, initialize `WorkingTreeService` and `StashService` after repository discovery. Add one switch case per new message and keep each case to one method call.

Maintain `workingTreeCache: WorkingTreeSnapshot` and `stashCache: StashEntry[]`; update them only after successful loads. Resolve working-tree diff paths from the current working-tree cache. Resolve stash action/detail requests only from an exact selector+hash cache match. `selectionDetails/request` does this:

- Commits: calculate range with `computeDiffRange`, then load `GitService.getCommitDetails` and `GitService.getDiffSummary` in parallel.
- Stash: load through `StashService.getDetails`.
- Store `{range, files}` in the existing diff cache so `file/openDiff` continues to work.
- Echo `requestId` and `selection` unchanged.

For destructive actions, call `vscode.window.showWarningMessage` with `{ modal: true }` before invoking the service. On cancellation, return `ok: false` with `message: 'Cancelled'` and no refresh targets.

On stash apply failure, still return `refresh: ['changes']`. On other failures, return a concise message and the refresh targets needed to reconcile state.

- [ ] **Step 5: Run tests and typecheck**

Run: `node --experimental-strip-types test/detailSelection.mts && npm run typecheck`

Expected: PASS after all exhaustiveness errors in `MessageHandler` are resolved.

- [ ] **Step 6: Commit**

```bash
git add shared/messages.ts src/ipc/MessageHandler.ts webview-ui/src/utils/detailSelection.ts test/detailSelection.mts
git commit -m "feat: add workspace and stash ipc"
```

---

### Task 5: Open Working-Tree and Index Diffs

**Files:**
- Create: `src/utils/workingTreeDiff.ts`
- Create: `src/services/WorkingTreeDiffNavigator.ts`
- Modify: `src/services/RepoLocator.ts`
- Modify: `src/ipc/MessageHandler.ts`
- Create: `test/workingTreeDiff.mts`

- [ ] **Step 1: Write failing diff endpoint tests**

Create `test/workingTreeDiff.mts`:

```ts
import assert from 'node:assert/strict';
import { workingTreeDiffSpec } from '../src/utils/workingTreeDiff.ts';

assert.deepEqual(workingTreeDiffSpec('staged', 'new.ts'), {
  left: { kind: 'git', ref: 'HEAD', path: 'new.ts' },
  right: { kind: 'git', ref: 'index', path: 'new.ts' },
});
assert.deepEqual(workingTreeDiffSpec('changes', 'new.ts'), {
  left: { kind: 'git', ref: 'index', path: 'new.ts' },
  right: { kind: 'file', path: 'new.ts' },
});
assert.equal(workingTreeDiffSpec('conflicts', 'conflict.ts').mergePath, 'conflict.ts');

console.log('working tree diff checks passed');
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --experimental-strip-types test/workingTreeDiff.mts`

Expected: FAIL because the utility is missing.

- [ ] **Step 3: Implement the pure spec and navigator**

Define `DiffEndpoint` as either `{kind:'git'; ref:string; path:string}` or `{kind:'file'; path:string}`. Return mergePath for conflicts. For untracked paths, the navigator replaces the left index endpoint with a Git URI at `EMPTY_TREE_HASH` when the selected change status is `?`.

`WorkingTreeDiffNavigator.open` receives the current snapshot, group, and path. It rejects paths not present in that group. For conflicts, try `git.openMergeEditor` with the file URI and fall back to `vscode.open`. For staged/unstaged files, convert Git endpoints with `api.toGitUri` and execute `vscode.diff` with a stable title.

- [ ] **Step 4: Subscribe to repository state changes**

Extend the minimal Git API types in `RepoLocator.ts` so a repository exposes `state.onDidChange`. Add `getActiveRepository()` returning that minimal repository object.

In `MessageHandler`, subscribe after initialization, debounce notifications by 100 ms, and post `{type:'workingTree/changed'}`. Dispose the subscription, debounce timer, and `WorkingTreeDiffNavigator` in `dispose()`.

- [ ] **Step 5: Run tests and typecheck**

Run: `node --experimental-strip-types test/workingTreeDiff.mts && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/workingTreeDiff.ts src/services/WorkingTreeDiffNavigator.ts src/services/RepoLocator.ts src/ipc/MessageHandler.ts test/workingTreeDiff.mts
git commit -m "feat: open working tree diffs"
```

---

### Task 6: Build the Changes Hook and Components

**Files:**
- Create: `webview-ui/src/hooks/useWorkingTree.ts`
- Create: `webview-ui/src/components/ChangesPanel.tsx`
- Create: `webview-ui/src/components/ChangeGroup.tsx`
- Create: `test/workbenchChanges.tsx`

- [ ] **Step 1: Write failing Changes rendering tests**

Start `test/workbenchChanges.tsx` with static rendering of a snapshot containing all three groups. Assert:

```ts
assert.match(html, />Merge Changes</);
assert.match(html, />Staged Changes</);
assert.match(html, />Changes</);
assert.match(html, /textarea[^>]*rows="1"/);
assert.match(html, /title="Commit staged changes"/);
assert.match(html, /title="Stash changes"/);
assert.match(html, /codicon-add/);
assert.match(html, /codicon-remove/);
assert.match(html, /codicon-discard/);
```

Render again with whitespace message and no staged files; assert the Commit button is disabled. Render with staged files and a message; assert it is enabled.

- [ ] **Step 2: Run the component test and verify RED**

Run: `node test/runTsxTest.mjs test/workbenchChanges.tsx`

Expected: FAIL because `ChangesPanel` does not exist.

- [ ] **Step 3: Implement `useWorkingTree`**

The hook owns:

- Latest snapshot and request ID refs.
- `loading`, `busy`, and `error`.
- Message draft.
- Selected keys in `${group}:${path}` format using the existing multi-select behavior.
- Requests on mount and after `workingTree/changed`.
- Ignoring mismatched response IDs.
- Action callbacks that post typed messages.
- Refresh dispatch from `workingTree/actionResult` through callback props `{onRefreshCommits,onRefreshStashes}`.
- Clearing the message only after successful Commit or Stash.

Return typed view state and callbacks; do not return raw IPC messages.

- [ ] **Step 4: Implement render-only components**

`ChangesPanel` receives the hook result as explicit props. Use a one-row textarea with an input handler that sets height to `auto`, then clamps `scrollHeight` to 120 px. Render action buttons with codicons and tooltips. Keep button dimensions fixed.

`ChangeGroup` renders a section heading/count, group action icons, and stable file rows. A file row click selects it; double-click or the filename action opens its diff. Stage is shown for Changes/Merge Changes, Unstage for Staged Changes, and Discard for every applicable row.

No Git, IPC, confirmation, or refresh logic belongs in either component.

- [ ] **Step 5: Run component tests and typecheck**

Run: `node test/runTsxTest.mjs test/workbenchChanges.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add webview-ui/src/hooks/useWorkingTree.ts webview-ui/src/components/ChangesPanel.tsx webview-ui/src/components/ChangeGroup.tsx test/workbenchChanges.tsx
git commit -m "feat: add changes workbench ui"
```

---

### Task 7: Build Stash and Shared Detail Hooks

**Files:**
- Create: `webview-ui/src/hooks/useStashes.ts`
- Create: `webview-ui/src/hooks/useSelectionDetails.ts`
- Create: `webview-ui/src/components/StashList.tsx`
- Modify: `test/workbenchChanges.tsx`
- Remove: `webview-ui/src/hooks/useCommitDetails.ts`

- [ ] **Step 1: Add failing stash rendering tests**

Extend `test/workbenchChanges.tsx` to render two stash entries and assert selector, message, time element, selected state, Refresh, Apply, and Delete controls. Assert Apply/Delete are disabled with no selection and enabled with one selected entry.

- [ ] **Step 2: Run the component test and verify RED**

Run: `node test/runTsxTest.mjs test/workbenchChanges.tsx`

Expected: FAIL because `StashList` is missing.

- [ ] **Step 3: Implement `useStashes` and `StashList`**

`useStashes` owns latest-request rejection, list/error/loading/busy state, and exactly one selected stash. Selecting a stash calls `onSelect(entry)`; clearing it calls `onSelect(null)`. Apply and Delete post the cached selector/hash pair. Delete success clears selection; Apply retains it. Refresh increments the request ID and requests the latest 10 entries.

`StashList` renders one fixed-height row per entry with selector, first-line message, and relative time using existing formatter patterns. Use codicon buttons in the section toolbar for Refresh, Apply, and Delete. Keep it render-only.

- [ ] **Step 4: Implement unified detail loading**

`useSelectionDetails(selection)` replaces `useCommitDetails`. It increments a request ID whenever the selection key changes, clears local state for `null`, posts one `selectionDetails/request`, and accepts only the current request ID. Return `{range, files, details, loading, error}`.

Keep `useCommitDetails.ts` unchanged in this task because `App.tsx` still imports it. Task 8 switches `App.tsx` atomically and then deletes the old hook.

- [ ] **Step 5: Run tests and typecheck**

Run: `node test/runTsxTest.mjs test/workbenchChanges.tsx && npm run typecheck`

Expected: component tests and both TypeScript projects PASS.

- [ ] **Step 6: Commit**

```bash
git add webview-ui/src/hooks/useStashes.ts webview-ui/src/hooks/useSelectionDetails.ts webview-ui/src/components/StashList.tsx test/workbenchChanges.tsx
git commit -m "feat: add stash list and shared details state"
```

---

### Task 8: Compose the Five Workbench Sections

**Files:**
- Modify: `webview-ui/src/App.tsx`
- Create: `webview-ui/src/components/WorkbenchToolbar.tsx`
- Modify: `webview-ui/src/components/ViewVisibilityMenu.tsx`
- Modify: `test/workbenchComponents.tsx`
- Modify: `test/workbenchChanges.tsx`
- Remove: `webview-ui/src/hooks/useCommitDetails.ts`

- [ ] **Step 1: Write failing five-section structure tests**

Update `test/workbenchComponents.tsx` to render five `ViewSection` instances and a five-item visibility menu. Assert the exact sibling order with `indexOf(data-view-id=...)`, and assert all labels appear:

```ts
for (const label of ['Changes', 'Commits', 'Stashes', 'Changed Files', 'Commit Details']) {
  assert.match(html, new RegExp(`>${label}<`));
}
assert.ok(
  html.indexOf('data-view-id="changes"') < html.indexOf('data-view-id="commits"') &&
  html.indexOf('data-view-id="commits"') < html.indexOf('data-view-id="stashes"') &&
  html.indexOf('data-view-id="stashes"') < html.indexOf('data-view-id="files"') &&
  html.indexOf('data-view-id="files"') < html.indexOf('data-view-id="details"')
);
```

Add a source assertion in `test/workbenchChanges.tsx` that `FilterBar` appears inside the Commits `ViewSection` content rather than before `ResizablePanelStack`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node test/runTsxTest.mjs test/workbenchComponents.tsx && node test/runTsxTest.mjs test/workbenchChanges.tsx`

Expected: FAIL because the app/menu still exposes three sections.

- [ ] **Step 3: Refactor `ViewVisibilityMenu` and add global toolbar**

Change the menu props to:

```ts
interface Props {
  views: Record<WorkbenchViewId, WorkbenchViewState>;
  onVisibleChange: (id: WorkbenchViewId, visible: boolean) => void;
}
```

Render `WORKBENCH_VIEW_IDS` with a label map. `WorkbenchToolbar` contains only this menu and remains outside the resizable stack. It must be 26 px high and must not contain commit filters.

- [ ] **Step 4: Compose Changes, Commits, Stashes, Files, Details**

In `App`:

- Instantiate `useWorkingTree`, `useStashes`, and `useSelectionDetails`.
- Keep commit multi-selection but clear stash selection on commit clicks.
- Clear commit selection before selecting a stash.
- Derive `DetailSelection | null` from the active source.
- Replace the old commit details and diff effects with `useSelectionDetails` output.
- Move `FilterBar` into Commits content immediately before `CommitList`.
- Use `layout.sizes` in `ResizablePanelStack`.
- Add Changes and Stashes panes in the exact required order.
- Pass shared `range/files/details` output to existing `ChangedFilesPanel` and `CommitDetailsPanel`.
- Keep existing context-menu/history actions unchanged.

Remove obsolete diff and commit-details listeners/state from `App`, then delete `useCommitDetails.ts`.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `node test/runTsxTest.mjs test/workbenchComponents.tsx && node test/runTsxTest.mjs test/workbenchChanges.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add webview-ui/src/App.tsx webview-ui/src/components/WorkbenchToolbar.tsx webview-ui/src/components/ViewVisibilityMenu.tsx webview-ui/src/hooks/useCommitDetails.ts test/workbenchComponents.tsx test/workbenchChanges.tsx
git commit -m "feat: compose five git workbench sections"
```

---

### Task 9: Style and Verify the Complete Workflow

**Files:**
- Modify: `webview-ui/src/styles.css`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Add CSS contract assertions before styling**

Extend `test/workbenchChanges.tsx` to read `styles.css` and assert stable dimensions and responsive behavior:

```ts
assert.match(styles, /\.workbench-toolbar\s*\{[^}]*height:\s*26px/s);
assert.match(styles, /\.change-item\s*\{[^}]*min-height:\s*24px/s);
assert.match(styles, /\.change-message-input\s*\{[^}]*resize:\s*none/s);
assert.match(styles, /\.stash-item\s*\{[^}]*grid-template-columns:/s);
assert.match(styles, /@media\s*\(max-width:\s*499px\)[\s\S]*\.stash-item/s);
```

- [ ] **Step 2: Run the CSS contract test and verify RED**

Run: `node test/runTsxTest.mjs test/workbenchChanges.tsx`

Expected: FAIL because the new selectors are absent.

- [ ] **Step 3: Add scoped VS Code-native styling**

Add styles for:

- A 26 px global workbench toolbar with the menu aligned right.
- One-row commit input, bounded auto-growth, focus border, and fixed action bar.
- Compact change group headers and 24 px minimum file rows.
- Stable icon button boxes and selected/hover states based on VS Code variables.
- Status colors for `?`, `U`, and `T` in addition to existing file statuses.
- Stash rows with selector, truncating message, and fixed time column.
- Narrow-screen rules that hide secondary time text before allowing overlap.

Do not add gradients, decorative cards, nested cards, or non-theme palette colors except existing status fallbacks.

- [ ] **Step 4: Add aggregate scripts and update README**

Add:

```json
"test:workbench-changes": "node --experimental-strip-types test/detailSelection.mts && node --experimental-strip-types test/workingTreeDiff.mts && node test/runTsxTest.mjs test/workbenchChanges.tsx"
```

Update README Features with Changes/Stage/Unstage/Discard/Commit and recent Stashes/Apply/Delete. Update Project Layout only if new directories were introduced; none are expected.

- [ ] **Step 5: Run the full verification suite**

Run:

```bash
npm run test:working-tree
npm run test:stashes
npm run test:workbench-changes
npm run test:app-commit-pagination
npm run test:commit-pagination
npm run test:commit-details
npm run test:commit-graph
npm run test:persisted-filters
node test/runTsxTest.mjs test/changedFilesPanel.tsx
node test/runTsxTest.mjs test/commitListPagination.tsx
node test/runTsxTest.mjs test/refreshToolbar.tsx
node test/runTsxTest.mjs test/workbenchComponents.tsx
node --experimental-strip-types test/workbenchLayout.mts
npm run typecheck
npm run build
```

Expected: every command exits 0 with no TypeScript or build errors.

- [ ] **Step 6: Inspect the final diff**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; only planned source, test, README, and package files are modified.

- [ ] **Step 7: Commit**

```bash
git add README.md package.json webview-ui/src/styles.css test/workbenchChanges.tsx
git commit -m "test: verify changes and stashes workflow"
```

---

## Completion Check

- [ ] Confirm the workbench order is Changes, Commits, Stashes, Changed Files, Commit Details.
- [ ] Confirm commit filters render only inside Commits.
- [ ] Confirm Commit affects staged files only and preserves the message on failure.
- [ ] Confirm normal Stash excludes untracked files and uses a custom message when present.
- [ ] Confirm Apply keeps the stash and Delete verifies identity before dropping.
- [ ] Confirm commit and stash selections are mutually exclusive.
- [ ] Confirm destructive operations show modal confirmation.
- [ ] Confirm all focused tests, existing tests, typechecks, and build pass.
