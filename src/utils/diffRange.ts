/**
 * Diff range computation: derive base..head from selected commit hashes
 * Pure function, unit-testable
 */
import type { Commit, DiffRange, FileStatus } from '../../shared/domain';

/** Git empty tree hash, used as parent for root commit diffs */
export const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export type DiffSide = 'left' | 'right';

/**
 * Choose the git ref for one side of a file diff.
 * Added/untracked files do not exist on the left, and deleted files do not
 * exist on the right, so those sides must point at the git empty tree.
 */
export function diffSideRef(
  status: FileStatus,
  side: DiffSide,
  ref: string
): string {
  const empty =
    (side === 'left' && (status === 'A' || status === '?')) ||
    (side === 'right' && status === 'D');
  return empty ? EMPTY_TREE_HASH : ref;
}

/**
 * @param selectedHashes User-selected commit hash set (order-independent)
 * @param allCommits    Full commit list in git log order (newest first)
 * @returns Computed diff range; null when no selection
 *
 * Rules:
 *   - N=1: base = commit.parents[0] (empty tree for root), head = commit
 *   - N>1: Find the "oldest" commit in the selection (highest index in list), base = its parent;
 *          "newest" commit (lowest index), head = its hash
 *   - contiguous: Whether selected indices are consecutive (for UI hint about unselected commits)
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
