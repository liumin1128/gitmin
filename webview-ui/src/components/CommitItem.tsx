/**
 * commit 单行 UI，只负责渲染，不含业务逻辑
 */
import type { MouseEvent } from 'react';
import type { Commit } from '../../../shared/domain';
import type { GraphRow } from '../utils/commitGraph';
import { relativeTime, firstLine, shortHash } from '../utils/formatters';
import { CommitGraph } from './CommitGraph';

interface Props {
  commit: Commit;
  graphRow: GraphRow;
  maxLanes: number;
  selected: boolean;
  onClick: (item: string, event: MouseEvent) => void;
  onContextMenu: (item: string, event: MouseEvent) => void;
}

export function CommitItem({
  commit,
  graphRow,
  maxLanes,
  selected,
  onClick,
  onContextMenu,
}: Props) {
  return (
    <div
      className={`commit-item${selected ? ' is-selected' : ''}`}
      onClick={(e) => onClick(commit.hash, e)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(commit.hash, e);
      }}
      title={commit.message}
    >
      <CommitGraph row={graphRow} maxLanes={maxLanes} />
      <span className="commit-hash">{shortHash(commit.hash)}</span>
      <span className="commit-message">{firstLine(commit.message)}</span>
      <span className="commit-author">{commit.author}</span>
      <span className="commit-time">{relativeTime(commit.date)}</span>
    </div>
  );
}
