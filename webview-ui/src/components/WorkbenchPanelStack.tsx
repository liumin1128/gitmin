import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { WorkbenchPanelHeights, WorkbenchViewId } from '../utils/workbenchLayout';
import { t } from '../../../shared/i18n';
import {
  DEFAULT_AUTO_PANEL_HEIGHT,
  MIN_EXPANDED_PANEL_HEIGHT,
  PANEL_HEADER_HEIGHT,
  calculatePanelHeights,
  calculatePanelMaximumHeight,
  clampPanelHeight,
} from '../utils/panelSizing';

const useSynchronousLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface WorkbenchPanelDefinition {
  id: WorkbenchViewId;
  title: string;
  count?: number;
  visible: boolean;
  collapsed: boolean;
  actions?: ReactNode;
  content: ReactNode;
}

interface Props {
  panels: WorkbenchPanelDefinition[];
  heights: WorkbenchPanelHeights;
  onCollapsedChange: (id: WorkbenchViewId, collapsed: boolean) => void;
  onHeightChange: (id: WorkbenchViewId, height: number | null) => void;
}

export function WorkbenchPanelStack({
  panels,
  heights,
  onCollapsedChange,
  onHeightChange,
}: Props) {
  const stackRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [naturalHeights, setNaturalHeights] = useState<Partial<WorkbenchPanelHeights>>({});
  const visiblePanels = useMemo(() => panels.filter((panel) => panel.visible), [panels]);
  const fillPanelId = [...visiblePanels].reverse().find((panel) => !panel.collapsed)?.id;
  const sizingInputs = useMemo(
    () => visiblePanels.map((panel) => ({
      id: panel.id,
      collapsed: panel.collapsed,
      preferredHeight: heights[panel.id],
      naturalHeight: naturalHeights[panel.id] ?? DEFAULT_AUTO_PANEL_HEIGHT,
    })),
    [heights, naturalHeights, visiblePanels]
  );
  const resolvedHeights = useMemo(
    () => calculatePanelHeights(sizingInputs, containerHeight),
    [containerHeight, sizingInputs]
  );

  const measureContainer = useCallback(() => {
    const next = Math.round(stackRef.current?.getBoundingClientRect().height ?? 0);
    setContainerHeight((current) => current === next ? current : next);
  }, []);

  useSynchronousLayoutEffect(measureContainer, [measureContainer, visiblePanels.length]);
  useEffect(() => {
    const element = stackRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureContainer);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measureContainer]);

  const handleNaturalHeightChange = useCallback((id: WorkbenchViewId, height: number) => {
    setNaturalHeights((current) => {
      const nextHeight = Math.max(PANEL_HEADER_HEIGHT, Math.round(height));
      return current[id] === nextHeight ? current : { ...current, [id]: nextHeight };
    });
  }, []);

  if (visiblePanels.length === 0) return null;

  return (
    <div ref={stackRef} className="workbench-panel-stack">
      {visiblePanels.map((panel) => (
        <WorkbenchPanel
          key={panel.id}
          panel={panel}
          height={resolvedHeights[panel.id] ?? PANEL_HEADER_HEIGHT}
          maximumHeight={calculatePanelMaximumHeight(
            sizingInputs,
            panel.id,
            containerHeight
          )}
          automaticHeight={heights[panel.id] === null}
          resizable={panel.id !== fillPanelId}
          onCollapsedChange={onCollapsedChange}
          onHeightChange={onHeightChange}
          onNaturalHeightChange={handleNaturalHeightChange}
        />
      ))}
    </div>
  );
}

interface PanelProps {
  panel: WorkbenchPanelDefinition;
  height: number;
  maximumHeight: number;
  automaticHeight: boolean;
  resizable: boolean;
  onCollapsedChange: Props['onCollapsedChange'];
  onHeightChange: Props['onHeightChange'];
  onNaturalHeightChange: (id: WorkbenchViewId, height: number) => void;
}

function WorkbenchPanel({
  panel,
  height,
  maximumHeight,
  automaticHeight,
  resizable,
  onCollapsedChange,
  onHeightChange,
  onNaturalHeightChange,
}: PanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const contentId = `${panel.id}-panel-content`;
  const actionLabel = t(panel.collapsed ? 'panel.expand' : 'panel.collapse', {
    title: panel.title,
  });
  const stopPropagation = (event: MouseEvent) => event.stopPropagation();
  const style = {
    '--panel-height': `${panel.collapsed ? PANEL_HEADER_HEIGHT : height}px`,
    ...(Number.isFinite(maximumHeight) ? { maxHeight: `${maximumHeight}px` } : {}),
  } as CSSProperties;
  const minimumHeight = Math.min(MIN_EXPANDED_PANEL_HEIGHT, maximumHeight);

  const measureContent = useCallback(() => {
    const content = contentRef.current;
    if (!content || panel.collapsed) return;
    const childrenHeight = Array.from(content.children).reduce((total, child) => {
      const element = child as HTMLElement;
      return total + Math.max(element.scrollHeight, element.getBoundingClientRect().height);
    }, 0);
    onNaturalHeightChange(
      panel.id,
      PANEL_HEADER_HEIGHT + (childrenHeight || content.scrollHeight)
    );
  }, [onNaturalHeightChange, panel.collapsed, panel.id]);

  useSynchronousLayoutEffect(measureContent, [measureContent, panel.content]);
  useEffect(() => {
    const content = contentRef.current;
    if (!content || panel.collapsed) return;
    let frame = 0;
    const scheduleMeasurement = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measureContent);
    };
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleMeasurement);
    resizeObserver?.observe(content);
    Array.from(content.children).forEach((child) => resizeObserver?.observe(child));
    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(scheduleMeasurement);
    mutationObserver?.observe(content, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [measureContent, panel.collapsed]);

  const stopDragging = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
  }, []);
  useEffect(() => stopDragging, [stopDragging]);

  const startDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    stopDragging();
    const startY = event.clientY;
    const startHeight = panelRef.current?.getBoundingClientRect().height ?? height;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const move = (nextEvent: PointerEvent) => {
      nextEvent.preventDefault();
      onHeightChange(
        panel.id,
        clampPanelHeight(startHeight + nextEvent.clientY - startY, maximumHeight)
      );
    };
    const stop = () => stopDragging();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  };

  const handleSashKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextHeight = height;
    if (event.key === 'ArrowUp') nextHeight -= 16;
    else if (event.key === 'ArrowDown') nextHeight += 16;
    else if (event.key === 'Home') nextHeight = PANEL_HEADER_HEIGHT;
    else if (event.key === 'End') nextHeight = maximumHeight;
    else return;
    event.preventDefault();
    onHeightChange(panel.id, clampPanelHeight(nextHeight, maximumHeight));
  };

  return (
    <section
      ref={panelRef}
      className={`workbench-panel${panel.collapsed ? ' is-collapsed' : ''}`}
      data-workbench-panel={panel.id}
      data-height-mode={automaticHeight ? 'auto' : 'manual'}
      style={style}
    >
      <div className="workbench-panel-header">
        <button
          type="button"
          className="workbench-panel-toggle"
          aria-label={actionLabel}
          title={actionLabel}
          aria-expanded={!panel.collapsed}
          aria-controls={contentId}
          onClick={() => onCollapsedChange(panel.id, !panel.collapsed)}
        >
          <span className="workbench-panel-chevron" aria-hidden="true">›</span>
          <span className="workbench-panel-title">{panel.title}</span>
          {panel.count !== undefined && panel.count > 0 && (
            <span className="workbench-panel-count">{panel.count}</span>
          )}
        </button>
        {panel.actions && (
          <div className="workbench-panel-actions" onClick={stopPropagation}>
            {panel.actions}
          </div>
        )}
      </div>
      {!panel.collapsed && (
        <>
          <div ref={contentRef} id={contentId} className="workbench-panel-content">
            {panel.content}
          </div>
          {resizable && (
            <div
              className="workbench-panel-sash"
              role="separator"
              aria-label={t('panel.resize', { title: panel.title })}
              aria-orientation="horizontal"
              aria-valuemin={Math.round(minimumHeight)}
              aria-valuemax={Math.round(maximumHeight)}
              aria-valuenow={Math.round(height)}
              title={t('panel.resizeHint', { title: panel.title })}
              tabIndex={0}
              onPointerDown={startDragging}
              onDoubleClick={() => onHeightChange(panel.id, null)}
              onKeyDown={handleSashKeyDown}
            />
          )}
        </>
      )}
    </section>
  );
}
