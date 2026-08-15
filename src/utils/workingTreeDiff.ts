import type { WorkingTreeGroup } from '../../shared/domain';

// vscode.git uses "~" as the virtual ref for index contents.
export type DiffEndpoint =
  | { kind: 'git'; ref: 'HEAD' | '~'; path: string }
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
      right: { kind: 'git', ref: '~', path },
    };
  }
  return {
    left: { kind: 'git', ref: '~', path: sourcePath },
    right: { kind: 'file', path },
  };
}
