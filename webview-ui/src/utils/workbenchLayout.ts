import {
  WORKBENCH_VIEW_IDS,
  type WorkbenchViewId,
} from '../../../shared/workbenchViews.ts';
import { MIN_EXPANDED_PANEL_HEIGHT } from './panelSizing.ts';

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
  lastResizedPanel: WorkbenchViewId | null;
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
  lastResizedPanel: null,
  views: {
    repositories: { visible: false, collapsed: false },
    changes: { visible: false, collapsed: false },
    commits: { visible: true, collapsed: false },
    stashes: { visible: false, collapsed: false },
    files: { visible: true, collapsed: false },
    details: { visible: false, collapsed: false },
  },
};

const VERSION_2_VIEW_IDS = ['changes', 'commits', 'stashes', 'files', 'details'] as const;

function defaultLayout(): WorkbenchLayoutState {
  return {
    version: 4,
    heights: { ...DEFAULT_WORKBENCH_LAYOUT.heights },
    lastResizedPanel: null,
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

/**
 * A stored height below the expanded minimum shows nothing but the panel
 * header, which reads as a blank panel. Treat such values as automatic so the
 * panel falls back to its content height instead of staying empty.
 */
function normalizePanelHeight(height: number | null): number | null {
  return height !== null && height < MIN_EXPANDED_PANEL_HEIGHT ? null : height;
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
    lastResizedPanel?: unknown;
    views?: Record<string, unknown>;
  };
  const storedHeights = state.heights;
  const storedViews = state.views;

  if (
    state.version === 4 &&
    isPanelHeights(storedHeights) &&
    storedViews &&
    WORKBENCH_VIEW_IDS.every((id) => isViewState(storedViews[id]))
  ) {
    const heights = Object.fromEntries(
      WORKBENCH_VIEW_IDS.map((id) => [id, normalizePanelHeight(storedHeights[id])])
    ) as WorkbenchPanelHeights;
    const lastResizedPanel = WORKBENCH_VIEW_IDS.find(
      (id) => id === state.lastResizedPanel && heights[id] !== null
    ) ?? null;
    return {
      version: 4,
      heights,
      lastResizedPanel,
      views: Object.fromEntries(
        WORKBENCH_VIEW_IDS.map((id) => [id, { ...(storedViews[id] as WorkbenchViewState) }])
      ) as Record<WorkbenchViewId, WorkbenchViewState>,
    };
  }

  if (state.version === 3 && storedViews) {
    const next = defaultLayout();
    WORKBENCH_VIEW_IDS.forEach((id) => {
      if (isViewState(storedViews[id])) next.views[id] = { ...storedViews[id] };
    });
    return next;
  }

  if (state.version === 2 && storedViews) {
    const next = defaultLayout();
    VERSION_2_VIEW_IDS.forEach((id) => {
      if (isViewState(storedViews[id])) next.views[id] = { ...storedViews[id] };
    });
    return next;
  }

  if (state.version === 1 && storedViews) {
    const next = defaultLayout();
    for (const id of ['commits', 'files', 'details'] as const) {
      if (isViewState(storedViews[id])) next.views[id] = { ...storedViews[id] };
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
  const nextHeight = normalizePanelHeight(height);
  let lastResizedPanel = state.lastResizedPanel;
  if (nextHeight !== null) lastResizedPanel = id;
  else if (lastResizedPanel === id) lastResizedPanel = null;
  if (state.heights[id] === nextHeight && state.lastResizedPanel === lastResizedPanel) {
    return state;
  }
  return { ...state, heights: { ...state.heights, [id]: nextHeight }, lastResizedPanel };
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
