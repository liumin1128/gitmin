import type { WorkingTreeGroup } from '../../shared/domain';

export type DiffEndpoint =
  | { kind: 'git'; ref: 'HEAD' | 'index'; path: string }
  | { kind: 'file'; path: string };

export type WorkingTreeDiffSpec =
  | { mergePath: string }
  | { left: DiffEndpoint; right: DiffEndpoint };

export function workingTreeDiffSpec(
  group: WorkingTreeGroup,
  path: string,
  oldPath?: string
): WorkingTreeDiffSpec {
  if (group === 'conflicts') return { mergePath: path };
  const sourcePath = oldPath ?? path;
  if (group === 'staged') {
    return {
      left: { kind: 'git', ref: 'HEAD', path: sourcePath },
      right: { kind: 'git', ref: 'index', path },
    };
  }
  return {
    left: { kind: 'git', ref: 'index', path: sourcePath },
    right: { kind: 'file', path },
  };
}
