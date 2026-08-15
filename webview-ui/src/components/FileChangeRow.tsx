import type { MouseEventHandler, ReactNode, Ref } from 'react';
import type { FileStatus } from '../../../shared/domain';
import { getFileCodicon } from '../utils/fileIcon';

interface Props {
  path: string;
  oldPath?: string;
  status: FileStatus;
  active?: boolean;
  selected?: boolean;
  nested?: boolean;
  trailing?: ReactNode;
  rowRef?: Ref<HTMLDivElement>;
  onClick: MouseEventHandler<HTMLDivElement>;
}

export function FileChangeRow({
  path,
  oldPath,
  status,
  active = false,
  selected,
  nested = false,
  trailing,
  rowRef,
  onClick,
}: Props) {
  return (
    <div
      ref={rowRef}
      className={`file-change-row status-${status}${
        active ? ' is-active' : ''
      }${selected ? ' is-selected' : ''}${nested ? ' is-nested' : ''}${
        status === 'D' ? ' is-deleted' : ''
      }`}
      aria-current={active ? 'true' : undefined}
      aria-selected={selected}
      title={oldPath ? `${oldPath} → ${path}` : path}
      onClick={onClick}
    >
      <span
        className={`file-type-icon codicon codicon-${getFileCodicon(path)}`}
        aria-hidden="true"
      />
      <span className="file-path">{path}</span>
      <span className="file-row-trailing">{trailing}</span>
      <span className="file-status">{status}</span>
    </div>
  );
}
