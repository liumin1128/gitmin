import type { FileChange } from '../../shared/domain';

export function getAdjacentFileChange(
  files: FileChange[],
  filePath: string,
  offset: -1 | 1
): FileChange | undefined {
  const index = files.findIndex((file) => file.path === filePath);
  if (index < 0 || files.length === 0) return undefined;
  return files[(index + offset + files.length) % files.length];
}
