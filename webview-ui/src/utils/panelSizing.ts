export const PANEL_HEADER_HEIGHT = 26;
export const MIN_EXPANDED_PANEL_HEIGHT = 50;
export const DEFAULT_AUTO_PANEL_HEIGHT = 120;

export interface PanelSizingInput {
  id: string;
  collapsed: boolean;
  preferredHeight: number | null;
  naturalHeight: number;
}

interface ExpandedPanel extends PanelSizingInput {
  desiredHeight: number;
}

export function findFillPanelId(
  panels: readonly Pick<PanelSizingInput, 'id' | 'collapsed'>[]
): string | undefined {
  for (let index = panels.length - 1; index >= 0; index -= 1) {
    if (!panels[index].collapsed) return panels[index].id;
  }
  return undefined;
}

export function clampPanelHeight(height: number, maximumHeight: number): number {
  const maximum = Math.max(PANEL_HEADER_HEIGHT, Math.round(maximumHeight));
  const minimum = Math.min(MIN_EXPANDED_PANEL_HEIGHT, maximum);
  return Math.min(maximum, Math.max(minimum, Math.round(height)));
}

export function calculatePanelMaximumHeight(
  panels: readonly PanelSizingInput[],
  targetId: string,
  containerHeight: number
): number {
  if (containerHeight <= 0) return Number.MAX_SAFE_INTEGER;
  const fillPanelId = findFillPanelId(panels);
  const reserved = panels.reduce((total, panel) => {
    if (panel.id === targetId) return total;
    if (panel.collapsed) return total + PANEL_HEADER_HEIGHT;
    if (panel.id === fillPanelId || panel.preferredHeight === null) {
      return total + MIN_EXPANDED_PANEL_HEIGHT;
    }
    return total + resolveDesiredHeight(panel, panel.preferredHeight);
  }, 0);
  return Math.max(PANEL_HEADER_HEIGHT, containerHeight - reserved);
}

export function calculatePanelHeights(
  panels: readonly PanelSizingInput[],
  containerHeight: number
): Record<string, number> {
  const heights: Record<string, number> = {};
  const expanded: ExpandedPanel[] = [];
  let collapsedHeight = 0;
  const fillPanelId = findFillPanelId(panels);

  panels.forEach((panel) => {
    if (panel.collapsed) {
      heights[panel.id] = PANEL_HEADER_HEIGHT;
      collapsedHeight += PANEL_HEADER_HEIGHT;
      return;
    }
    const preferredHeight = panel.id === fillPanelId ? null : panel.preferredHeight;
    expanded.push({
      ...panel,
      preferredHeight,
      desiredHeight: resolveDesiredHeight(panel, preferredHeight),
    });
  });

  if (expanded.length === 0) return heights;
  if (containerHeight <= 0) {
    expanded.forEach((panel) => {
      heights[panel.id] = Math.round(panel.desiredHeight);
    });
    return heights;
  }

  const capacity = Math.max(0, containerHeight - collapsedHeight);
  const minimum = Math.min(
    MIN_EXPANDED_PANEL_HEIGHT,
    Math.max(PANEL_HEADER_HEIGHT, capacity / expanded.length)
  );
  const desiredTotal = expanded.reduce((total, panel) => total + panel.desiredHeight, 0);
  if (desiredTotal <= capacity) {
    Object.assign(heights, fillLastPanel(expanded, capacity));
    return heights;
  }

  const manual = expanded.filter((panel) => panel.preferredHeight !== null);
  const automatic = expanded.filter((panel) => panel.preferredHeight === null);
  const manualTotal = manual.reduce((total, panel) => total + panel.desiredHeight, 0);
  if (manualTotal + automatic.length * minimum <= capacity) {
    manual.forEach((panel) => {
      heights[panel.id] = Math.round(panel.desiredHeight);
    });
    Object.assign(heights, fitPanels(automatic, capacity - manualTotal, minimum));
    return heights;
  }

  Object.assign(heights, fitPanels(expanded, capacity, minimum));
  return heights;
}

function resolveDesiredHeight(
  panel: PanelSizingInput,
  preferredHeight: number | null
): number {
  const requested = preferredHeight ?? panel.naturalHeight;
  return Math.max(
    MIN_EXPANDED_PANEL_HEIGHT,
    Number.isFinite(requested) ? requested : DEFAULT_AUTO_PANEL_HEIGHT
  );
}

function fillLastPanel(
  panels: readonly ExpandedPanel[],
  capacity: number
): Record<string, number> {
  let consumed = 0;
  return Object.fromEntries(
    panels.map((panel, index) => {
      const height = index === panels.length - 1
        ? Math.max(PANEL_HEADER_HEIGHT, Math.round(capacity - consumed))
        : Math.round(panel.desiredHeight);
      consumed += height;
      return [panel.id, height];
    })
  );
}

function fitPanels(
  panels: readonly ExpandedPanel[],
  capacity: number,
  minimum: number
): Record<string, number> {
  if (panels.length === 0) return {};
  const availableExtra = Math.max(0, capacity - minimum * panels.length);
  const desiredExtra = panels.reduce(
    (total, panel) => total + Math.max(0, panel.desiredHeight - minimum),
    0
  );
  let consumed = 0;
  return Object.fromEntries(
    panels.map((panel, index) => {
      const isLast = index === panels.length - 1;
      const extra = desiredExtra > 0
        ? (Math.max(0, panel.desiredHeight - minimum) / desiredExtra) * availableExtra
        : availableExtra / panels.length;
      const height = isLast
        ? Math.max(PANEL_HEADER_HEIGHT, capacity - consumed)
        : Math.max(PANEL_HEADER_HEIGHT, Math.round(minimum + extra));
      consumed += height;
      return [panel.id, height];
    })
  );
}
