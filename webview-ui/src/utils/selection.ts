/**
 * Selection set pure function operations
 * Independent of React and DOM, easy to unit test
 */

/** Single select: keep only item */
export function selectSingle(item: string): Set<string> {
  return new Set([item]);
}

/** Ctrl/Cmd+Click: toggle item */
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
 * Shift+Click: select range from anchor to target (inclusive)
 * items is the full visible list; if anchor/target is not in the list, returns single select of target
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
