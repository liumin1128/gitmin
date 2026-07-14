# GitMin Changes and Stashes Design

## Goal

Extend the existing GitMin workbench from three sibling sections to five:

1. Changes
2. Commits
3. Stashes
4. Changed Files
5. Commit Details

The Changes section should cover the core local-change workflow offered by VS Code SCM. The Stashes section should expose the most recent 10 stashes and reuse the existing Changed Files and Commit Details sections for inspection.

## Layout

The application remains a single React webview using the existing resizable sibling-section layout. The five sections appear in this fixed order:

`Changes -> Commits -> Stashes -> Changed Files -> Commit Details`

Each section remains independently collapsible, visible, and resizable. The existing view visibility menu remains in a minimal global toolbar so hidden sections can always be restored.

The current commit filter bar moves into the top of the expanded Commits section. It no longer consumes global space when Commits is collapsed.

## Changes Section

### Commit Input

- Use a multiline textarea whose initial height is one row.
- Grow the textarea as the message gains lines, within a bounded maximum height.
- Commit requires a non-whitespace message and at least one staged file.
- A successful commit clears the message and refreshes Changes and Commits.
- A failed commit preserves the message.

### Change Groups

Display these groups when they contain entries:

1. Merge Changes
2. Staged Changes
3. Changes

Each group supports file selection, including Ctrl/Cmd multi-select and Shift range selection. Each file row displays its Git status and path. Renames show both the previous and current path.

Clicking a file opens the relevant comparison:

- Merge Changes: open the merge-aware change view when available, otherwise open the current file.
- Staged Changes: compare HEAD with the index.
- Changes: compare the index with the working tree.
- Untracked files: compare an empty document with the working-tree file.

### Change Actions

Support individual, selected-file, and whole-group actions where they are valid:

- Stage
- Unstage
- Discard
- Refresh

Stage adds tracked, deleted, renamed, and untracked paths to the index. Staging a merge conflict marks that path as resolved.

Unstage removes selected index changes while preserving working-tree content.

Discard is destructive and always uses a VS Code modal confirmation:

- Tracked unstaged files are restored from the index.
- Staged files are first unstaged, then restored only when the user explicitly discards the staged change.
- Untracked files and directories are removed with `git clean` scoped to the confirmed paths.
- Merge changes are restored to HEAD after confirmation.

Every path passed to Git is separated from command options with `--`.

### Commit and Stash

Commit only includes Staged Changes. It does not implicitly stage files.

The Stash button follows normal Git stash scope:

- A non-empty message runs the equivalent of `git stash push -m <message>`.
- An empty message runs the equivalent of `git stash`.
- Untracked files are not included because normal `git stash` excludes them.

A successful stash clears the message and refreshes Changes and Stashes. If Git reports that there are no local changes to save, the UI reports that result without treating it as a destructive failure.

## Stashes Section

Load the most recent 10 stash entries. Each row shows:

- Selector, such as `stash@{0}`
- Subject/message
- Creation time

Stash selection is single-select. Selecting a stash clears commit selection. Selecting a commit clears stash selection.

The section provides:

- Refresh
- Apply
- Delete

Apply runs `git stash apply` against the selected stash hash and does not remove the stash. It refreshes Changes whether the operation succeeds or produces conflicts. Conflicts remain in the repository and appear under Merge Changes.

Delete requires a VS Code modal confirmation. Before `git stash drop <selector>`, the extension resolves the selector again and verifies that it still points to the originally selected hash. If it changed, deletion is rejected and the list is refreshed.

After Apply, the stash remains selected. After Delete, stash selection and its displayed details are cleared.

## Shared Details

Commit and stash selection share one active inspection source.

For a selected commit, existing behavior remains unchanged.

For a selected stash:

- Changed Files compares the stash's first parent with the stash commit.
- Commit Details displays the stash commit's subject, body, author, date, parents, and refs using the existing details presentation.
- File clicks use the existing committed-revision diff navigation for the stash base/hash range.

Resetting or refreshing the active source must not allow stale asynchronous responses from the previous source to overwrite the current details.

## Architecture

### Extension Host

`WorkingTreeService` owns the local-change use case:

- Read working-tree/index/conflict status
- Stage and unstage paths
- Discard paths
- Commit staged changes
- Create a stash

`StashService` owns stash behavior:

- Parse and return the latest 10 entries
- Read a stash's details and changed files
- Apply a stash
- Verify and delete a stash

`WorkingTreeDiffNavigator` owns working-tree and index diff URI construction and editor opening. The existing `FileDiffNavigator` continues to handle commit and stash snapshot ranges.

`MessageHandler` remains the IPC entry point. It routes messages, converts service exceptions into typed results, and coordinates refresh targets. Git behavior stays out of React components and IPC message parsing stays out of services.

### Webview

`useWorkingTree` owns Changes state, request sequencing, action state, and IPC messages.

`useStashes` owns stash list state, single selection, details requests, action state, and IPC messages.

`ChangesPanel`, `ChangeGroup`, and `StashList` are presentation components. They receive typed data and callbacks and contain no Git or IPC logic.

`App` composes the five sections and coordinates mutually exclusive commit/stash selection. Pure helper functions handle selection transitions and action availability.

### Shared Types and IPC

Add typed domain models for:

- Working-tree change entries and groups
- Working-tree snapshot
- Stash entry
- Active detail source

Add discriminated IPC messages for:

- Changes load and refresh
- Changes actions
- Stash list load and refresh
- Stash details
- Stash actions

Every asynchronous query carries a request ID. The webview ignores responses that do not match the latest request, preventing older refreshes from replacing current state.

## Refresh Behavior

Refresh targets are explicit:

- Commit: Changes and Commits
- Create stash: Changes and Stashes
- Stage, Unstage, Discard: Changes
- Apply stash: Changes
- Delete stash: Stashes

The extension listens for built-in Git repository state changes and emits a debounced change notification. The webview then requests a fresh working-tree snapshot. Manual refresh remains available for both Changes and Stashes.

## Errors and Busy States

Changes and Stashes keep independent loading, busy, and error states. A failed action in one section does not block the other sections or commit history browsing.

Actions are disabled when their preconditions are not met. In particular:

- Commit requires a message and staged files.
- Apply and Delete require one selected stash.
- Stage, Unstage, and Discard require applicable selected paths or a non-empty group.

Service errors are converted to concise user-facing messages. Raw Git output is retained only for extension logging.

Stash Apply is not rolled back after conflicts because Git may have partially applied changes. The UI reports the conflict and refreshes Merge Changes immediately.

## Testing

Use test-driven development for each behavior.

Pure-function tests cover:

- Working-tree status conversion
- Stash output parsing
- Commit/stash selection transitions
- Action availability
- Request ID stale-response rejection

Temporary-repository integration tests cover:

- Stage and unstage
- Commit staged files only
- Stash with and without a custom message
- Apply without dropping
- Safe stash deletion
- Tracked and untracked discard
- Conflict refresh behavior where practical

React static-rendering tests cover:

- Five sibling sections in the required order
- Commit filters inside Commits
- Change groups and action states
- Stash rows and selected state
- Shared Changed Files and Commit Details presentation

Final verification runs all existing tests, new focused tests, TypeScript type checking, and the production build.

## Acceptance Criteria

- The workbench contains five same-level sections in the agreed order.
- Commit filters appear inside Commits.
- Changes supports viewing diffs, multi-selection, Stage, Unstage, Discard, Commit, Stash, and Refresh.
- Commit operates only on staged files.
- Stash follows normal Git scope and uses the entered message when present.
- Stashes displays the latest 10 entries and supports inspection, Apply, Delete, and Refresh.
- Commit and stash selections are mutually exclusive and drive the shared details sections.
- Destructive actions are confirmed and scoped to validated paths or stash identities.
- New behavior is covered by focused automated tests and all existing checks continue to pass.

## Out of Scope

- Push, pull, sync, branch, tag, remote, and repository management features
- Stash pop, branch-from-stash, or include-untracked options
- Partial-line staging
- Multiple repositories in one GitMin view
