/**
 * 多选交互 hook：封装 Ctrl/Shift/单击 行为
 * 依赖纯函数 utils/selection，本 hook 只做 state 管理
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
 * @param items 完整可见列表（用于 Shift 范围计算），顺序需与 UI 显示顺序一致
 */
export function useMultiSelect(items: readonly string[]): MultiSelectAPI {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  const onItemClick = useCallback(
    (item: string, event: MouseEvent) => {
      if (event.shiftKey) {
        setSelected(selectRange(items, anchorRef.current, item));
        // Shift 时不改锚点
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
