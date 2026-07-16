import {
  WORKBENCH_VIEW_IDS,
  type WorkbenchViewId,
} from '../../../shared/workbenchViews.ts';

export { WORKBENCH_VIEW_IDS };
export type { WorkbenchViewId };

export interface WorkbenchViewState {
  visible: boolean;
  collapsed: boolean;
}

export type WorkbenchPanelHeights = Record<WorkbenchViewId, number | null>;

export interface WorkbenchLayoutState {
  version: 4;
  heights: WorkbenchPanelHeights;
  views: Record<WorkbenchViewId, WorkbenchViewState>;
}

export const DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayoutState = {
  version: 4,
  heights: {
    repositories: null,
    changes: null,
    commits: null,
    stashes: null,
    files: null,
    details: null,
  },
  views: {
    repositories: { visible: true, collapsed: false },
    changes: { visible: true, collapsed: false },
    commits: { visible: true, collapsed: false },
    stashes: { visible: true, collapsed: false },
    files: { visible: true, collapsed: false },
    details: { visible: true, collapsed: false },
  },
};

const VERSION_2_VIEW_IDS = ['changes', 'commits', 'stashes', 'files', 'details'] as const;

function defaultLayout(): WorkbenchLayoutState {
  return {
    version: 4,
    heights: { ...DEFAULT_WORKBENCH_LAYOUT.heights },
    views: Object.fromEntries(
      WORKBENCH_VIEW_IDS.map((id) => [id, { ...DEFAULT_WORKBENCH_LAYOUT.views[id] }])
    ) as Record<WorkbenchViewId, WorkbenchViewState>,
  };
}

function isViewState(value: unknown): value is WorkbenchViewState {
  if (!value || typeof value !== 'object') return false;
  const view = value as Record<string, unknown>;
  return typeof view.visible === 'boolean' && typeof view.collapsed === 'boolean';
}

function isPanelHeight(value: unknown): value is number | null {
  return value === null || (
    typeof value === 'number' && Number.isFinite(value) && value >= 26
  );
}

function isPanelHeights(value: unknown): value is WorkbenchPanelHeights {
  if (!value || typeof value !== 'object') return false;
  const heights = value as Record<string, unknown>;
  return WORKBENCH_VIEW_IDS.every((id) => isPanelHeight(heights[id]));
}

export function parseWorkbenchLayout(value: unknown): WorkbenchLayoutState {
  if (!value || typeof value !== 'object') return defaultLayout();
  const state = value as {
    version?: unknown;
    heights?: unknown;
    views?: Record<string, unknown>;
  };

  if (
    state.version === 4 &&
    isPanelHeights(state.heights) &&
    state.views &&
    WORKBENCH_VIEW_IDS.every((id) => isViewState(state.views?.[id]))
  ) {
    return {
      version: 4,
      heights: { ...state.heights },
      views: Object.fromEntries(
        WORKBENCH_VIEW_IDS.map((id) => [id, { ...(state.views![id] as WorkbenchViewState) }])
      ) as Record<WorkbenchViewId, WorkbenchViewState>,
    };
  }

  if (state.version === 3 && state.views) {
    const next = defaultLayout();
    WORKBENCH_VIEW_IDS.forEach((id) => {
      if (isViewState(state.views?.[id])) next.views[id] = { ...state.views[id] };
    });
    return next;
  }

  if (state.version === 2 && state.views) {
    const next = defaultLayout();
    VERSION_2_VIEW_IDS.forEach((id) => {
      if (isViewState(state.views?.[id])) next.views[id] = { ...state.views[id] };
    });
    return next;
  }

  if (state.version === 1 && state.views) {
    const next = defaultLayout();
    for (const id of ['commits', 'files', 'details'] as const) {
      if (isViewState(state.views[id])) next.views[id] = { ...state.views[id] };
    }
    return next;
  }

  return defaultLayout();
}

export function setWorkbenchPanelHeight(
  state: WorkbenchLayoutState,
  id: WorkbenchViewId,
  height: number | null
): WorkbenchLayoutState {
  if (!isPanelHeight(height)) return state;
  return { ...state, heights: { ...state.heights, [id]: height } };
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
