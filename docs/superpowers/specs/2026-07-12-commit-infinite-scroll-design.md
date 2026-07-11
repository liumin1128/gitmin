# Commit Infinite Scroll Design

## Goal

Load recent commits in batches of 50 and fetch the next batch only when the
commit list reaches its bottom.

## Design

- Extend the commit-list IPC request with `offset` and `limit`.
- `GitService` maps them to `git log --skip <offset> -n <limit>` while keeping
  all existing filters intact.
- The extension returns a commit page containing the commits and `hasMore`.
  It keeps the full loaded sequence as its cache so existing selection, diff,
  and Git action behavior continues to work across pages.
- The webview resets pagination on initial load, filter changes, refresh, and
  successful Git actions. It appends subsequent pages without replacing the
  loaded commits.
- `CommitList` owns only scroll-bottom detection and reports it through an
  `onLoadMore` callback. `App` owns request state, pagination state, and IPC.

## Boundaries

- A request is ignored while another page is loading or when `hasMore` is
  false.
- A reset response supersedes earlier loaded data. Appended pages are accepted
  only when they match the current pagination sequence.
- The final partial page sets `hasMore` to false; no extra empty request is
  required.

## Verification

- Unit-test Git log argument construction with offsets.
- Component-test scroll-bottom detection without duplicate load requests.
- Test page replacement, page append, and reset behavior in the webview state
  flow.
- Run type checks, the existing sanity tests, the production build, and
  `git diff --check`.
