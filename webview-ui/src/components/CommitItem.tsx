/**
 * commit 单行 UI，只负责渲染，不含业务逻辑
 * 各列根据 ColumnFlags 条件渲染，grid-template-columns 与之保持一致由父组件生成
 */
import type { MouseEvent } from 'react';
import type { Commit } from '../../../shared/domain';
import type { GraphRow } from '../utils/commitGraph';
import { relativeTime, firstLine, shortHash } from '../utils/formatters';
import { CommitGraph } from './CommitGraph';
import type { ColumnFlags } from './CommitList';

interface Props {
  commit: Commit;
  columns: ColumnFlags;
  graphRow: GraphRow;
  maxLanes: number;
  selected: boolean;
  onClick: (item: string, event: MouseEvent) => void;
  onContextMenu: (item: string, event: MouseEvent) => void;
}

export function CommitItem({
  commit,
  columns,
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
      {columns.graph && <CommitGraph row={graphRow} maxLanes={maxLanes} />}
      <span className="commit-message">{firstLine(commit.message)}</span>
      {columns.author && <span className="commit-author">{commit.author}</span>}
      {columns.hash && <span className="commit-hash">{shortHash(commit.hash)}</span>}
      {columns.time && <span className="commit-time">{relativeTime(commit.date)}</span>}
      {columns.tags && commit.refs.length > 0 && (
        <span className="commit-tags">
          {commit.refs.map((ref) => (
            <span key={ref} className="commit-tag">{ref}</span>
          ))}
        </span>
      )}
    </div>
  );
}
