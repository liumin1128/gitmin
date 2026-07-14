import type { StashEntry } from '../../shared/domain';

export const STASH_LIST_FORMAT = '%gd%x00%H%x00%P%x00%aI%x00%gs%x1e';

export function parseStashList(output: string): StashEntry[] {
  if (!output) return [];

  const entries: StashEntry[] = [];
  for (const rawRecord of output.split('\x1e')) {
    const record = rawRecord.replace(/^[\r\n]+|[\r\n]+$/g, '');
    if (!record) continue;
    const [selector, hash, parents, date, message] = record.split('\0');
    const parentHash = parents?.trim().split(/\s+/)[0];
    if (!selector || !hash || !parentHash || !date || message === undefined) continue;
    entries.push({ selector, hash, parentHash, message, date });
  }
  return entries;
}
