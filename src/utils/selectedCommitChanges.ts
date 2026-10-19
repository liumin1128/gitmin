import type { DiffRange, FileChange } from '../../shared/domain';

export interface CommitFileChanges {
  range: Pick<DiffRange, 'base' | 'head'>;
  files: FileChange[];
}

/** Join selected changes, oldest first, retaining each file's own revisions. */
export function mergeSelectedCommitChanges(changes: CommitFileChanges[]): FileChange[] {
  const files = new Map<string, FileChange>();

  for (const { range, files: commitFiles } of changes) {
    // Resolve against the previous commit so renames cannot consume another
    // change from the same commit (for example, renaming then recreating a path).
    const previousFiles = new Map(files);
    const renamedPaths = new Set(
      commitFiles.filter((file) => file.status === 'R').map((file) => file.oldPath)
    );
    const updates: FileChange[] = [];
    for (const file of commitFiles) {
      const previousPath = file.status === 'R' ? file.oldPath! : file.path;
      const previous = file.status === 'A' && renamedPaths.has(file.path)
        ? undefined : previousFiles.get(previousPath);
      if (!previous) {
        updates.push({ ...file, diffRange: { ...range } });
        continue;
      }

      files.delete(previousPath);
      if ((previous.status === 'A' || previous.status === 'C') && file.status === 'D') {
        continue;
      }

      const oldPath = previous.oldPath ?? previous.path;
      let status: FileChange['status'] = 'M';
      if (previous.status === 'A') status = 'A';
      else if (file.status === 'D') status = 'D';
      else if (oldPath !== file.path) status = previous.status === 'C' ? 'C' : 'R';
      else if (file.status === 'T') status = 'T';
      updates.push({
        ...file,
        oldPath: status !== 'A' && oldPath !== file.path ? oldPath : undefined,
        status,
        insertions: previous.insertions + file.insertions,
        deletions: previous.deletions + file.deletions,
        binary: previous.binary || file.binary,
        diffRange: { base: previous.diffRange!.base, head: range.head },
      });
    }
    for (const file of updates) files.set(file.path, file);
  }

  return [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
}
