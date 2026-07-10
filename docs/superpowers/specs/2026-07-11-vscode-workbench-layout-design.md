# VS Code Workbench Layout Design

## Goal

Refine the commit management webview into a VS Code-native workbench with collapsible, resizable, and hideable content sections.

## Visual Direction

Use VS Code workbench conventions rather than a standalone product aesthetic:

- Theme all surfaces, borders, focus states, hover states, and text with VS Code CSS variables.
- Render commit and changed-file content under compact uppercase section headers.
- Keep search, filters, refresh, and column settings in the existing top toolbar.
- Avoid decorative cards, gradients, oversized controls, and custom visual ornament.

## Responsive Layout

- At widths of 700 px or more, show the commit and changed-file sections side by side.
- Below 700 px, stack the sections vertically.
- Place an interactive separator between visible expanded sections.
- Use a default split ratio of 60:40 and constrain dragging so neither section becomes unusably small.
- If one section is hidden or collapsed, the other section consumes the available content area.

## Section Interaction

Each section has a VS Code-style header containing a disclosure icon, title, optional count, and contextual actions.

- Clicking the header toggles collapsed state.
- A top-level overflow menu controls visibility for the commit and changed-file sections.
- Hiding both sections is allowed because the overflow menu remains available as the recovery entry point.
- The separator supports pointer dragging and keyboard arrow adjustments, with separator semantics for accessibility.

## Components

- `ViewSection`: presents a section header, collapse interaction, and content region.
- `ResizableSplitView`: selects horizontal or vertical layout and manages the interactive separator.
- `ViewVisibilityMenu`: exposes checked visibility actions for both sections.
- `useWorkbenchLayout`: owns layout state and synchronizes it with Webview persistence.
- Pure layout utilities: validate persisted state, clamp split ratios, and calculate updates without React or DOM dependencies.
- `App`: retains Git data and IPC responsibilities and only composes the layout components.
- `CommitList` and `ChangedFilesPanel`: retain their existing rendering responsibilities.

## State Persistence

Persist a versioned layout state through the VS Code Webview state API. The state includes:

- Split ratio.
- Commit section collapsed and visible flags.
- Changed-files section collapsed and visible flags.

Invalid, incomplete, or incompatible saved state falls back to defaults. Layout state never changes Git data, filters, selection, or IPC messages.

## Verification

- Unit-test default state, persisted-state validation, split-ratio clamping, and state transitions.
- Component-test section headers, visibility controls, and separator rendering.
- Run both TypeScript project checks, existing sanity checks, and the production build.
- Inspect wide and narrow screenshots to verify responsive orientation, theme consistency, focus states, text fit, and absence of overlap.
