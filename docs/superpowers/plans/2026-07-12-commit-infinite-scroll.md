# Commit Infinite Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initially display 50 commits and append 50 more when the user reaches the commit-list bottom.

**Architecture:** `CommitList` only reports a bottom-scroll event. `App` owns request identity, offsets, replacement, and append state. The extension runs `git log --skip`, returns a typed page, and appends it to the existing cache used by actions and diffs.

**Tech Stack:** TypeScript, React 18, VS Code API, simple-git, Node assertions, esbuild.

---

## File Structure

- Create `shared/commitPagination.ts`: page constants, page payload type, pure bottom-threshold check.
- Modify `shared/messages.ts`: typed page request and response messages.
- Modify `src/services/GitService.ts`: exported log-argument helper with offset support.
- Modify `src/ipc/MessageHandler.ts`: page loading, response emission, and cache reset/append.
- Modify `webview-ui/src/components/CommitList.tsx`: scroll detection and callback props only.
- Modify `webview-ui/src/App.tsx`: page request lifecycle and list composition.
- Create `test/commitPagination.mts`: pure threshold and Git argument tests.
- Create `test/commitListPagination.tsx`: list paging-prop component contract test.

### Task 1: Define Paging Contract

**Files:** `shared/commitPagination.ts`, `shared/messages.ts`, `test/commitPagination.mts`

- [ ] **Step 1: Write the failing pure test**
  Create a Node assertion test that imports `COMMIT_PAGE_SIZE` and `isNearCommitListBottom`, expects a page size of 50, and verifies false at `(69, 100, 200)` and true at `(70, 100, 200)`.

- [ ] **Step 2: Verify the test fails**
  Run `node --experimental-strip-types test/commitPagination.mts`; expect a module-not-found failure.

- [ ] **Step 3: Implement `shared/commitPagination.ts`**
  Export `COMMIT_PAGE_SIZE = 50`; `CommitPage` with `requestId`, `offset`, `nextOffset`, `commits`, and `hasMore`; and `isNearCommitListBottom(scrollTop, clientHeight, scrollHeight)`, which returns true within 30px of the bottom.

- [ ] **Step 4: Extend IPC unions**
  Import `CommitPage` in `shared/messages.ts`. Add numeric `requestId` and `limit` to `webview/ready`; add `requestId`, `offset`, and `limit` to `commits/refresh`; change `commits/loaded` to `{ page: CommitPage }`; change `commits/error` to include `requestId`.

- [ ] **Step 5: Verify and commit**
  Run `node --experimental-strip-types test/commitPagination.mts`; expect `commit pagination checks passed`. Commit `shared/commitPagination.ts`, `shared/messages.ts`, and `test/commitPagination.mts` as `feat: define commit pagination contract`.

### Task 2: Page Git History

**Files:** `src/services/GitService.ts`, `src/ipc/MessageHandler.ts`, `test/commitPagination.mts`

- [ ] **Step 1: Add failing argument assertions**
  Extend the pure test to import `buildLogArgs` and assert that `buildLogArgs(50, 100)` contains `--skip`, `100`, `-n`, and `50` in that order.

- [ ] **Step 2: Verify the test fails**
  Run `node --experimental-strip-types test/commitPagination.mts`; expect the helper export/signature assertion to fail.

- [ ] **Step 3: Add Git offset support**
  Change `GitService.getLog` options to `{ offset?: number; limit?: number; filters?: CommitFilters }`. Export `buildLogArgs(limit, offset = 0, filters)` and place `--skip`, `String(offset)`, `-n`, and `String(limit)` after the existing format/decorate options. Preserve all branch, author, and date filters.

- [ ] **Step 4: Build and cache one page in `MessageHandler`**
  Change `initRepo` to pass its ready-message `requestId` and `limit` to an object-shaped `loadCommits` request with offset zero; route `commits/refresh` into the same method. It must invoke `getLog(request)`, apply the existing search filtering, emit `CommitPage { requestId, offset, nextOffset: offset + raw.length, commits, hasMore: raw.length === limit }`, replace `commitsCache` for offset zero, append otherwise, and retain `lastFilters`. If a raw page has no search matches but has more history, continue reading raw pages before replying so an empty filtered list does not get stuck without another scroll event. On failure post the correlated error. Remove the direct reload after successful Git actions, because the webview will reset pagination.

- [ ] **Step 5: Verify and commit**
  Run `node --experimental-strip-types test/commitPagination.mts`; expect success. Commit the service, handler, and test as `feat: page commit history in extension`.

### Task 3: Report Commit List Bottom

**Files:** `webview-ui/src/components/CommitList.tsx`, `test/commitListPagination.tsx`

- [ ] **Step 1: Write failing component contract test**
  Server-render `CommitList` with its current required props plus `hasMore`, `loadingMore`, and `onLoadMore`; assert the empty-list markup remains rendered.

- [ ] **Step 2: Verify the test fails**
  Run `node test/runTsxTest.mjs test/commitListPagination.tsx`; expect a TypeScript props error.

- [ ] **Step 3: Add presentation-only scroll detection**
  Add the three paging props. Import React `UIEvent` and `isNearCommitListBottom`; on the existing `.commit-list` element, invoke `onLoadMore` only when `hasMore`, not `loadingMore`, and the pure threshold reports bottom. Do not construct IPC messages or update paging state in this component. Keep the empty state exactly as is.

- [ ] **Step 4: Verify and commit**
  Run `node test/runTsxTest.mjs test/commitListPagination.tsx`; expect the component test success message. Commit component and test as `feat: report commit list bottom scroll`.

### Task 4: Orchestrate Webview Pages

**Files:** `webview-ui/src/App.tsx`, `test/commitListPagination.tsx`

- [ ] **Step 1: Add state and refs**
  Import `COMMIT_PAGE_SIZE`. Add request-ID, next-offset, and loading refs plus `hasMoreCommits` and `loadingMoreCommits` state. The refs prevent repeated bottom-scroll events from dispatching duplicate page requests before React rerenders.

- [ ] **Step 2: Implement `requestCommitPage`, `resetCommits`, and `loadMoreCommits`**
  `resetCommits` increments the request ID, clears selection and commits, resets the offset to zero, sets loading, and posts `commits/refresh` with `COMMIT_PAGE_SIZE`. `loadMoreCommits` returns while loading or at the final page; otherwise it sends the current request ID, `nextCommitOffsetRef.current`, and the current filters.

- [ ] **Step 3: Consume only matching pages**
  Change the commit-loaded listener to ignore pages whose `requestId` differs from the current ref, replace commits when page offset is zero, append otherwise, store `nextOffset`, update `hasMore`, clear loading, and clear errors. The error listener must likewise ignore stale request IDs and clear loading only for current errors.

- [ ] **Step 4: Replace fixed 100-item reloads**
  Send `webview/ready` with a new request ID and `COMMIT_PAGE_SIZE`. Replace fixed `limit: 100` calls in the filter effect and refresh callback with `resetCommits`. After successful non-copy actions, call `resetCommits`; leave copy-hash behavior unchanged. Pass `hasMoreCommits`, `loadingMoreCommits`, and `loadMoreCommits` explicitly into `CommitList`.

- [ ] **Step 5: Verify and commit**
  Run the two focused tests and `npm run typecheck`; expect all to pass. Commit `webview-ui/src/App.tsx` and the component test as `feat: load more commits on scroll`.

### Task 5: Full Regression Check

**Files:** all files above

- [ ] **Step 1: Run automated checks**
  Run `node --experimental-strip-types test/commitPagination.mts`, `node test/runTsxTest.mjs test/commitListPagination.tsx`, `npm run typecheck`, `node --experimental-strip-types test/sanity.mts`, `npm run build`, and `git diff --check`. Expect all commands to succeed.

- [ ] **Step 2: Verify in VS Code**
  Use a repository with more than 50 commits. Confirm each bottom scroll appends a page of at most 50, no request follows the final page, and filters, refresh, and non-copy Git actions reset to the newest 50 commits.
