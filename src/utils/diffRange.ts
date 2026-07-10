/**
 * diff range 计算：从选中的 commit hash 列表推导出 base..head
 * 纯函数，可单测
 */
import type { Commit, DiffRange } from '../../shared/domain';

/** git 空树 hash，用于根 commit 的父节点 diff */
export const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/**
 * @param selectedHashes 用户选中的 commit hash 集合（顺序无关）
 * @param allCommits    完整 commit 列表，按 git log 顺序（新的在前）
 * @returns 计算出的 diff range；无选中时返回 null
 *
 * 规则：
 *   - N=1：base = commit.parents[0]（若为根 commit 则用空树），head = commit
 *   - N>1：找选中集合中"最老"的 commit（在列表中索引最大者），base = 其父节点；
 *          "最新"的 commit（索引最小者），head = 其 hash
 *   - contiguous: 选中的索引是否连续（用于 UI 提示"含未选中 commit"）
 */
export function computeDiffRange(
  selectedHashes: string[],
  allCommits: Commit[]
): DiffRange | null {
  if (selectedHashes.length === 0) return null;

  const indexMap = new Map<string, number>();
  allCommits.forEach((c, i) => indexMap.set(c.hash, i));

  const indices: number[] = [];
  for (const h of selectedHashes) {
    const idx = indexMap.get(h);
    if (idx !== undefined) indices.push(idx);
  }
  if (indices.length === 0) return null;

  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);
  const newest = allCommits[minIdx]!;
  const oldest = allCommits[maxIdx]!;

  const base = oldest.parents[0] ?? EMPTY_TREE_HASH;
  const head = newest.hash;
  const contiguous = maxIdx - minIdx + 1 === indices.length;

  return { base, head, contiguous };
}
