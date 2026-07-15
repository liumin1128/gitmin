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

export type WorkbenchPaneSizes = Record<WorkbenchViewId, number>;

export interface WorkbenchLayoutState {
  version: 2;
  sizes: WorkbenchPaneSizes;
  views: Record<WorkbenchViewId, WorkbenchViewState>;
}

export const DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayoutState = {
  version: 2,
  sizes: {
    changes: 20,
    commits: 32,
    stashes: 16,
    files: 16,
    details: 16,
  },
  views: {
    changes: { visible: true, collapsed: false },
    commits: { visible: true, collapsed: false },
    stashes: { visible: true, collapsed: false },
    files: { visible: true, collapsed: false },
    details: { visible: true, collapsed: false },
  },
};

function defaultLayout(): WorkbenchLayoutState {
  return {
    version: 2,
    sizes: { ...DEFAULT_WORKBENCH_LAYOUT.sizes },
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

function isPaneSizes(value: unknown): value is WorkbenchPaneSizes {
  if (!value || typeof value !== 'object') return false;
  const sizes = value as Record<string, unknown>;
  return WORKBENCH_VIEW_IDS.every(
    (id) => typeof sizes[id] === 'number' && Number.isFinite(sizes[id]) && sizes[id] > 0
  );
}

function normalizePaneSizes(sizes: WorkbenchPaneSizes): WorkbenchPaneSizes {
  const total = WORKBENCH_VIEW_IDS.reduce((sum, id) => sum + sizes[id], 0);
  if (total <= 0) return { ...DEFAULT_WORKBENCH_LAYOUT.sizes };
  return Object.fromEntries(
    WORKBENCH_VIEW_IDS.map((id) => [id, (sizes[id] / total) * 100])
  ) as WorkbenchPaneSizes;
}

export function clampSplitRatio(value: number): number {
  return Math.min(80, Math.max(20, Math.round(value)));
}

export function parseWorkbenchLayout(value: unknown): WorkbenchLayoutState {
  if (!value || typeof value !== 'object') return defaultLayout();
  const state = value as {
    version?: unknown;
    sizes?: unknown;
    views?: Record<string, unknown>;
  };

  if (
    state.version === 2 &&
    isPaneSizes(state.sizes) &&
    state.views &&
    WORKBENCH_VIEW_IDS.every((id) => isViewState(state.views?.[id]))
  ) {
    return {
      version: 2,
      sizes: normalizePaneSizes(state.sizes),
      views: Object.fromEntries(
        WORKBENCH_VIEW_IDS.map((id) => [id, { ...(state.views![id] as WorkbenchViewState) }])
      ) as Record<WorkbenchViewId, WorkbenchViewState>,
    };
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

export function setWorkbenchPaneSizes(
  state: WorkbenchLayoutState,
  sizes: WorkbenchPaneSizes
): WorkbenchLayoutState {
  if (!isPaneSizes(sizes)) return state;
  return { ...state, sizes: normalizePaneSizes(sizes) };
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
