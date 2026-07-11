export type WorkbenchViewId = 'commits' | 'files' | 'details';

export interface WorkbenchViewState {
  visible: boolean;
  collapsed: boolean;
}

export interface WorkbenchLayoutState {
  version: 1;
  splitRatio: number;
  detailsSplitRatio: number;
  views: Record<WorkbenchViewId, WorkbenchViewState>;
}

export type WorkbenchPaneSizes = Record<WorkbenchViewId, number>;

export const DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayoutState = {
  version: 1,
  splitRatio: 60,
  detailsSplitRatio: 70,
  views: {
    commits: { visible: true, collapsed: false },
    files: { visible: true, collapsed: false },
    details: { visible: true, collapsed: false },
  },
};

function defaultLayout(): WorkbenchLayoutState {
  return {
    ...DEFAULT_WORKBENCH_LAYOUT,
    views: {
      commits: { ...DEFAULT_WORKBENCH_LAYOUT.views.commits },
      files: { ...DEFAULT_WORKBENCH_LAYOUT.views.files },
      details: { ...DEFAULT_WORKBENCH_LAYOUT.views.details },
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
    detailsSplitRatio?: unknown;
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
    detailsSplitRatio:
      typeof state.detailsSplitRatio === 'number' && Number.isFinite(state.detailsSplitRatio)
        ? clampSplitRatio(state.detailsSplitRatio)
        : DEFAULT_WORKBENCH_LAYOUT.detailsSplitRatio,
    views: {
      commits: { ...state.views.commits },
      files: { ...state.views.files },
      details: isViewState(state.views.details)
        ? { ...state.views.details }
        : { ...DEFAULT_WORKBENCH_LAYOUT.views.details },
    },
  };
}

export function setSplitRatio(
  state: WorkbenchLayoutState,
  splitRatio: number
): WorkbenchLayoutState {
  return { ...state, splitRatio: clampSplitRatio(splitRatio) };
}

export function setDetailsSplitRatio(
  state: WorkbenchLayoutState,
  detailsSplitRatio: number
): WorkbenchLayoutState {
  return { ...state, detailsSplitRatio: clampSplitRatio(detailsSplitRatio) };
}

export function getWorkbenchPaneSizes(state: WorkbenchLayoutState): WorkbenchPaneSizes {
  const commits = (state.detailsSplitRatio * state.splitRatio) / 100;
  return {
    commits,
    files: state.detailsSplitRatio - commits,
    details: 100 - state.detailsSplitRatio,
  };
}

export function setWorkbenchPaneSizes(
  state: WorkbenchLayoutState,
  sizes: WorkbenchPaneSizes
): WorkbenchLayoutState {
  const total = sizes.commits + sizes.files + sizes.details;
  const main = sizes.commits + sizes.files;
  if (total <= 0 || main <= 0) return state;

  return {
    ...state,
    detailsSplitRatio: clampSplitRatio((main / total) * 100),
    splitRatio: clampSplitRatio((sizes.commits / main) * 100),
  };
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
