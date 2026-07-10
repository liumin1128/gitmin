# Refresh Toolbar Design

## Goal

Remove the standalone repository title row and place refresh in the existing filter toolbar.

## UI Changes

- Remove the row that displays the current branch, repository name, selected count, and text refresh button.
- Add an icon-only refresh button to the right side of the filter toolbar, next to the column settings control.
- Keep an accessible title and label on the refresh button.

## Behavior

The refresh action remains unchanged: clear the selection, reload commits using the active filters, and reload filter options.

## Scope

Only the webview composition, filter toolbar, obsolete title component, and their styles are affected. Git operations, IPC messages, filtering, and commit rendering are unchanged.

## Verification

- Type-check both extension and webview projects.
- Build the extension.
- Run the existing sanity checks.
- Verify the title row is absent and the refresh control is rendered in the filter toolbar.
