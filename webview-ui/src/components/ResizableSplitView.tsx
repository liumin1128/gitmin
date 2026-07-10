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
  ratio: number;
  firstVisible: boolean;
  firstCollapsed: boolean;
  secondVisible: boolean;
  secondCollapsed: boolean;
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
  ratio,
  firstVisible,
  firstCollapsed,
  secondVisible,
  secondCollapsed,
  onRatioChange,
  first,
  second,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const wide = useWideLayout();
  const resizable = firstVisible && !firstCollapsed && secondVisible && !secondCollapsed;

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = wide
        ? ((clientX - rect.left) / rect.width) * 100
        : ((clientY - rect.top) / rect.height) * 100;
      onRatioChange(clampSplitRatio(next));
    },
    [onRatioChange, wide]
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
    if ((wide && event.key === 'ArrowLeft') || (!wide && event.key === 'ArrowUp')) next -= 2;
    else if ((wide && event.key === 'ArrowRight') || (!wide && event.key === 'ArrowDown')) next += 2;
    else if (event.key === 'Home') next = 20;
    else if (event.key === 'End') next = 80;
    else return;
    event.preventDefault();
    onRatioChange(clampSplitRatio(next));
  };

  const style = { '--split-ratio': `${ratio}%` } as CSSProperties;
  const classes = [
    'workbench-split',
    firstCollapsed ? 'is-first-collapsed' : '',
    secondCollapsed ? 'is-second-collapsed' : '',
    !firstVisible ? 'is-first-hidden' : '',
    !secondVisible ? 'is-second-hidden' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={rootRef} className={classes} style={style}>
      {first}
      {resizable && (
        <div
          className="workbench-separator"
          role="separator"
          aria-label="调整板块大小"
          aria-orientation={wide ? 'vertical' : 'horizontal'}
          aria-valuemin={20}
          aria-valuemax={80}
          aria-valuenow={ratio}
          tabIndex={0}
          onPointerDown={startDragging}
          onKeyDown={handleKeyDown}
        />
      )}
      {second}
    </div>
  );
}
