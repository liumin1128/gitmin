import type { DetailSelection, StashEntry } from '../../../shared/domain';

export function commitSelection(hashes: readonly string[]): DetailSelection | null {
  if (hashes.length === 0) return null;
  return { kind: 'commits', hashes: [...hashes].sort() };
}

export function stashSelection(
  entry: Pick<StashEntry, 'selector' | 'hash'> | null
): DetailSelection | null {
  if (!entry) return null;
  return { kind: 'stash', selector: entry.selector, hash: entry.hash };
}

export function acceptsResponse(responseId: number, currentId: number): boolean {
  return responseId === currentId;
}
