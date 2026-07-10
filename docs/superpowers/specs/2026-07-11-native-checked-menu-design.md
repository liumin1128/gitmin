# Native Checked Menu Design

## Goal

Replace browser checkbox controls in popup menus with VS Code-style checked menu items.

## Component

Create a reusable `CheckedMenuItem` that renders a full-width button with `menuitemcheckbox` semantics. A fixed leading column displays a check mark while selected and remains empty otherwise.

## Scope

- Replace checkbox rows in the column visibility menu.
- Replace checkbox rows in the workbench view visibility menu.
- Keep existing callbacks, menu positioning, persistence, and visibility behavior unchanged.

## Styling

Use VS Code menu foreground, selection background, selection foreground, focus border, and separator variables. Remove native checkbox rendering from these popup menus.

## Verification

- Component-test selected and unselected markup and accessibility state.
- Run existing component tests, type checking, sanity checks, and production build.
