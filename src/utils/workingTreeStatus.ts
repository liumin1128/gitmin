import type {
  FileStatus,
  WorkingTreeChange,
  WorkingTreeGroup,
  WorkingTreeSnapshot,
} from '../../shared/domain';

export interface RawStatusFile {
  path: string;
  from?: string;
  index: string;
  working_dir: string;
}

const CONFLICT_STATES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const SUPPORTED_STATUS = new Set<FileStatus>(['A', 'M', 'D', 'R', 'C', 'U', 'T', '?']);

export function toWorkingTreeSnapshot(files: readonly RawStatusFile[]): WorkingTreeSnapshot {
  const snapshot: WorkingTreeSnapshot = { conflicts: [], staged: [], changes: [] };

  for (const file of files) {
    const state = `${file.index}${file.working_dir}`;
    if (CONFLICT_STATES.has(state)) {
      snapshot.conflicts.push(toChange(file, 'conflicts', 'U'));
      continue;
    }

    if (file.index === '?' && file.working_dir === '?') {
      snapshot.changes.push(toChange(file, 'changes', '?'));
      continue;
    }

    const indexStatus = normalizeStatus(file.index);
    if (indexStatus) snapshot.staged.push(toChange(file, 'staged', indexStatus));

    const workingStatus = normalizeStatus(file.working_dir);
    if (workingStatus) snapshot.changes.push(toChange(file, 'changes', workingStatus));
  }

  snapshot.conflicts.sort(comparePath);
  snapshot.staged.sort(comparePath);
  snapshot.changes.sort(comparePath);
  return snapshot;
}

function normalizeStatus(status: string): FileStatus | null {
  if (status === ' ' || status === '' || status === '!') return null;
  return SUPPORTED_STATUS.has(status as FileStatus) ? (status as FileStatus) : 'M';
}

function toChange(
  file: RawStatusFile,
  group: WorkingTreeGroup,
  status: FileStatus
): WorkingTreeChange {
  return {
    path: file.path,
    ...(file.from ? { oldPath: file.from } : {}),
    status,
    group,
  };
}

function comparePath(a: WorkingTreeChange, b: WorkingTreeChange): number {
  return a.path.localeCompare(b.path);
}
