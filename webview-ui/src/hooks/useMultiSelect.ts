/**
 * Multi-select interaction hook: encapsulates Ctrl/Shift/Click behavior
 * Depends on pure functions utils/selection; this hook only manages state
 */
import { useCallback, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { selectSingle, selectRange, toggleSelection } from '../utils/selection';

export interface MultiSelectAPI {
  selected: Set<string>;
  isSelected: (item: string) => boolean;
  onItemClick: (item: string, event: MouseEvent) => void;
  selectOnly: (item: string) => void;
  clear: () => void;
}

/**
 * @param items Full visible list (for Shift range calculation), order must match the UI display order
 */
export function useMultiSelect(items: readonly string[]): MultiSelectAPI {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  const onItemClick = useCallback(
    (item: string, event: MouseEvent) => {
      if (event.shiftKey) {
        setSelected(selectRange(items, anchorRef.current, item));
        // Shift does not change anchor
      } else if (event.ctrlKey || event.metaKey) {
        setSelected((prev) => toggleSelection(prev, item));
        anchorRef.current = item;
      } else {
        setSelected(selectSingle(item));
        anchorRef.current = item;
      }
    },
    [items]
  );

  const isSelected = useCallback((item: string) => selected.has(item), [selected]);

  const selectOnly = useCallback((item: string) => {
    setSelected(selectSingle(item));
    anchorRef.current = item;
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    anchorRef.current = null;
  }, []);

  return { selected, isSelected, onItemClick, selectOnly, clear };
}
