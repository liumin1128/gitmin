export type WorkbenchViewId = 'commits' | 'files';

export interface WorkbenchViewState {
  visible: boolean;
  collapsed: boolean;
}

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

function defaultLayout(): WorkbenchLayoutState {
  return {
    ...DEFAULT_WORKBENCH_LAYOUT,
    views: {
      commits: { ...DEFAULT_WORKBENCH_LAYOUT.views.commits },
      files: { ...DEFAULT_WORKBENCH_LAYOUT.views.files },
    },
  };
}

function isViewState(value: unknown): value is WorkbenchViewState {
  if (!value || typeof value !== 'object') return false;
  const view = value as Record<string, unknown>;
  return typeof view.visible === 'boolean' && typeof view.collapsed === 'boolean';
}

export function clampSplitRatio(value: number): number {
  return Math.min(80, Math.max(20, Math.round(value)));
}

export function parseWorkbenchLayout(value: unknown): WorkbenchLayoutState {
  if (!value || typeof value !== 'object') return defaultLayout();
  const state = value as {
    version?: unknown;
    splitRatio?: unknown;
    views?: Record<string, unknown>;
  };
  if (
    state.version !== 1 ||
    typeof state.splitRatio !== 'number' ||
    !Number.isFinite(state.splitRatio) ||
    !state.views ||
    !isViewState(state.views.commits) ||
    !isViewState(state.views.files)
  ) {
    return defaultLayout();
  }
  return {
    version: 1,
    splitRatio: clampSplitRatio(state.splitRatio),
    views: {
      commits: { ...state.views.commits },
      files: { ...state.views.files },
    },
  };
}

export function setSplitRatio(
  state: WorkbenchLayoutState,
  splitRatio: number
): WorkbenchLayoutState {
  return { ...state, splitRatio: clampSplitRatio(splitRatio) };
}

export function setViewVisible(
  state: WorkbenchLayoutState,
  id: WorkbenchViewId,
  visible: boolean
): WorkbenchLayoutState {
  return {
    ...state,
    views: { ...state.views, [id]: { ...state.views[id], visible } },
  };
}

export function setViewCollapsed(
  state: WorkbenchLayoutState,
  id: WorkbenchViewId,
  collapsed: boolean
): WorkbenchLayoutState {
  return {
    ...state,
    views: { ...state.views, [id]: { ...state.views[id], collapsed } },
  };
}
