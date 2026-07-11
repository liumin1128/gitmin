import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  clampSplitRatio,
  type WorkbenchPaneSizes,
  type WorkbenchViewId,
} from '../utils/workbenchLayout';

interface PanelStackPane {
  id: WorkbenchViewId;
  visible: boolean;
  collapsed: boolean;
  content: ReactNode;
}

interface Props {
  panes: PanelStackPane[];
  sizes: WorkbenchPaneSizes;
  onSizesChange: (sizes: WorkbenchPaneSizes) => void;
}

export function resizeAdjacentPaneSizes(
  sizes: WorkbenchPaneSizes,
  firstId: WorkbenchViewId,
  secondId: WorkbenchViewId,
  firstShare: number
): WorkbenchPaneSizes {
  const total = (sizes[firstId] ?? 0) + (sizes[secondId] ?? 0);
  if (total <= 0) return sizes;

  const firstSize = total * (clampSplitRatio(firstShare) / 100);
  return { ...sizes, [firstId]: firstSize, [secondId]: total - firstSize };
}

export function ResizablePanelStack({ panes, sizes, onSizesChange }: Props) {
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const visiblePanes = panes.filter((pane) => pane.visible);

  const stopDragging = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
  }, []);

  useEffect(() => stopDragging, [stopDragging]);

  const resize = useCallback(
    (firstId: WorkbenchViewId, secondId: WorkbenchViewId, share: number) => {
      onSizesChange(resizeAdjacentPaneSizes(sizes, firstId, secondId, share));
    },
    [onSizesChange, sizes]
  );

  const startDragging = (
    event: ReactPointerEvent<HTMLDivElement>,
    firstId: WorkbenchViewId,
    secondId: WorkbenchViewId
  ) => {
    event.preventDefault();
    stopDragging();
    const firstPane = event.currentTarget.previousElementSibling?.getBoundingClientRect();
    const secondPane = event.currentTarget.nextElementSibling?.getBoundingClientRect();
    if (!firstPane || !secondPane) return;

    const top = firstPane.top;
    const height = secondPane.bottom - top;
    const move = (nextEvent: PointerEvent) => {
      nextEvent.preventDefault();
      resize(firstId, secondId, ((nextEvent.clientY - top) / height) * 100);
    };
    const stop = () => stopDragging();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    firstId: WorkbenchViewId,
    secondId: WorkbenchViewId
  ) => {
    const total = (sizes[firstId] ?? 0) + (sizes[secondId] ?? 0);
    const currentShare = total > 0 ? ((sizes[firstId] ?? 0) / total) * 100 : 50;
    let nextShare = currentShare;
    if (event.key === 'ArrowUp') nextShare -= 2;
    else if (event.key === 'ArrowDown') nextShare += 2;
    else if (event.key === 'Home') nextShare = 20;
    else if (event.key === 'End') nextShare = 80;
    else return;
    event.preventDefault();
    resize(firstId, secondId, nextShare);
  };

  if (visiblePanes.length === 0) return null;

  return (
    <div className="workbench-stack">
      {visiblePanes.map((pane, index) => {
        const nextPane = visiblePanes[index + 1];
        const resizable = nextPane && !pane.collapsed && !nextPane.collapsed;
        const paneStyle = {
          '--pane-grow': Math.max(0.01, sizes[pane.id] ?? 1),
        } as CSSProperties;

        return (
          <Fragment key={pane.id}>
            <div
              className={`workbench-pane${pane.collapsed ? ' is-collapsed' : ''}`}
              data-stack-pane={pane.id}
              style={paneStyle}
            >
              {pane.content}
            </div>
            {resizable && (
              <div
                className="workbench-separator"
                role="separator"
                aria-label={`Resize ${pane.id} and ${nextPane.id} panel`}
                aria-orientation="horizontal"
                aria-valuemin={20}
                aria-valuemax={80}
                aria-valuenow={Math.round(
                  ((sizes[pane.id] ?? 0) /
                    ((sizes[pane.id] ?? 0) + (sizes[nextPane.id] ?? 0))) * 100
                )}
                tabIndex={0}
                onPointerDown={(event) => startDragging(event, pane.id, nextPane.id)}
                onKeyDown={(event) => handleKeyDown(event, pane.id, nextPane.id)}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
