/**
 * 选择集合的纯函数操作
 * 与 React、DOM 无关，便于单测
 */

/** 单选：只保留 item */
export function selectSingle(item: string): Set<string> {
  return new Set([item]);
}

/** Ctrl/Cmd+Click：toggle item */
export function toggleSelection(prev: ReadonlySet<string>, item: string): Set<string> {
  const next = new Set(prev);
  if (next.has(item)) {
    next.delete(item);
  } else {
    next.add(item);
  }
  return next;
}

/**
 * Shift+Click：选中 anchor 到 target 的范围（含首尾）
 * items 为完整可见列表；若 anchor/target 不在列表内，返回单选 target
 */
export function selectRange(
  items: readonly string[],
  anchor: string | null,
  target: string
): Set<string> {
  if (!anchor) return selectSingle(target);
  const anchorIdx = items.indexOf(anchor);
  const targetIdx = items.indexOf(target);
  if (anchorIdx < 0 || targetIdx < 0) return selectSingle(target);
  const [start, end] =
    anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
  return new Set(items.slice(start, end + 1));
}
