import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { clampSplitRatio } from '../utils/workbenchLayout';

interface Props {
  orientation?: 'responsive' | 'horizontal' | 'vertical';
  ratio: number;
  firstVisible: boolean;
  firstCollapsed: boolean;
  firstCollapsedSize?: number;
  secondVisible: boolean;
  secondCollapsed: boolean;
  secondCollapsedSize?: number;
  onRatioChange: (ratio: number) => void;
  first: ReactNode;
  second: ReactNode;
}

function useWideLayout(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 700px)').matches
  );

  useEffect(() => {
    const query = window.matchMedia('(min-width: 700px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return wide;
}

export function ResizableSplitView({
  orientation = 'vertical',
  ratio,
  firstVisible,
  firstCollapsed,
  firstCollapsedSize,
  secondVisible,
  secondCollapsed,
  secondCollapsedSize,
  onRatioChange,
  first,
  second,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const wide = useWideLayout();
  const horizontal = orientation === 'horizontal' || (orientation === 'responsive' && wide);
  const resizable = firstVisible && !firstCollapsed && secondVisible && !secondCollapsed;

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = horizontal
        ? ((clientX - rect.left) / rect.width) * 100
        : ((clientY - rect.top) / rect.height) * 100;
      onRatioChange(clampSplitRatio(next));
    },
    [horizontal, onRatioChange]
  );

  const stopDragging = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
  }, []);

  useEffect(() => stopDragging, [stopDragging]);

  const startDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    stopDragging();
    const move = (nextEvent: PointerEvent) => {
      nextEvent.preventDefault();
      updateFromPointer(nextEvent.clientX, nextEvent.clientY);
    };
    const stop = () => stopDragging();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next = ratio;
    if ((horizontal && event.key === 'ArrowLeft') || (!horizontal && event.key === 'ArrowUp')) next -= 2;
    else if ((horizontal && event.key === 'ArrowRight') || (!horizontal && event.key === 'ArrowDown')) next += 2;
    else if (event.key === 'Home') next = 20;
    else if (event.key === 'End') next = 80;
    else return;
    event.preventDefault();
    onRatioChange(clampSplitRatio(next));
  };

  const style = { '--split-ratio': `${ratio}%` } as CSSProperties;
  const collapsedStyle = (size: number | undefined) =>
    size === undefined
      ? undefined
      : ({ '--collapsed-pane-size': `${Math.max(26, Math.round(size))}px` } as CSSProperties);
  if (!firstVisible && !secondVisible) return null;

  const classes = [
    'workbench-split',
    horizontal ? 'is-horizontal' : 'is-vertical',
    firstCollapsed ? 'is-first-collapsed' : '',
    secondCollapsed ? 'is-second-collapsed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={rootRef} className={classes} style={style}>
      {firstVisible && (
        <div
          className={`workbench-pane is-first${firstCollapsed ? ' is-collapsed' : ''}`}
          style={firstCollapsed ? collapsedStyle(firstCollapsedSize) : undefined}
        >
          {first}
        </div>
      )}
      {resizable && (
        <div
          className="workbench-separator"
          role="separator"
          aria-label="调整板块大小"
          aria-orientation={horizontal ? 'vertical' : 'horizontal'}
          aria-valuemin={20}
          aria-valuemax={80}
          aria-valuenow={ratio}
          tabIndex={0}
          onPointerDown={startDragging}
          onKeyDown={handleKeyDown}
        />
      )}
      {secondVisible && (
        <div
          className={`workbench-pane is-second${secondCollapsed ? ' is-collapsed' : ''}`}
          style={secondCollapsed ? collapsedStyle(secondCollapsedSize) : undefined}
        >
          {second}
        </div>
      )}
    </div>
  );
}
