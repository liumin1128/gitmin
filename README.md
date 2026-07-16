# GitMin

![GitMin](icon.png)

WebStorm-like Git commit management panel for VSCode. Browse commit history, inspect changes, and rewrite history (revert, squash, drop, reset) without leaving the editor.

## Features

- Commit history panel in the activity bar, with an option to open as an editor tab
- Repository picker for switching between Git repositories in multi-root workspaces
- Working tree panel with staged, unstaged, and merge changes
- Stage, unstage, discard, commit, and stash workflows
- Copilot-powered commit message generation from staged changes
- OpenAI-compatible custom model support with secure API key storage and custom prompts
- Recent stash inspection with apply and delete actions
- Commit graph with branch lanes
- Filter by search (text / regex / case-sensitive), branch, author, and date range
- Commit details panel: author, committer, signature, refs, and body
- Changed files panel with cumulative diff stats and one-click file diff
- Previous / Next file diff navigation in the editor toolbar
- History rewriting: copy hash, revert, squash, drop, reset --soft / --mixed / --hard
- Infinite scroll pagination for large repositories
- Content-sized, independently resizable workbench panels and configurable columns
- Persisted filters across sessions

## Commands

| Command | Description |
| --- | --- |
| `GitMin: Open Panel in Editor` | Open the GitMin panel as an editor tab |
| `GitMin: Previous File Diff` | Navigate to the previous file in the current diff |
| `GitMin: Next File Diff` | Navigate to the next file in the current diff |

## Requirements

- VSCode 1.90.0 or newer
- The built-in `git` extension must be enabled
- A git repository in the current workspace

## Build & Develop

```bash
npm install
npm run build      # one-off build
npm run watch      # watch mode
npm run typecheck  # type-check extension + webview
```

Package a VSIX with `vsce package` (see existing `*.vsix` artifacts in the repo root).

## Project Layout

```
src/          Extension host (panels, services, ipc, utils)
webview-ui/   React webview UI (components, hooks, utils)
shared/       Types and IPC protocol shared between host and webview
resources/    Rebase sequence editor script for interactive rebase
test/         Standalone test scripts
```

## Tech Stack

- TypeScript
- React 18 (webview)
- simple-git (git operations)
- esbuild (bundler)

## Notes

- History rewriting operations require a clean working tree (except `reset --hard`, which prompts for a second confirmation in the UI).
- Interactive rebase uses a custom `GIT_SEQUENCE_EDITOR` script; conflicts auto-abort to avoid leaving the repo in a rebase state.
