/**
 * commit 列表容器：只负责渲染 + 事件冒泡
 * 多选状态由父组件通过 useMultiSelect 提供
 * 图布局由 layoutCommits 一次算出，grid-template-columns 由 columns 可见性动态生成
 */
import { useMemo, type CSSProperties, type MouseEvent } from 'react';
import type { Commit } from '../../../shared/domain';
import { layoutCommits } from '../utils/commitGraph';
import { CommitItem } from './CommitItem';

/** 列可见性；message 恒可见故不列 */
export interface ColumnFlags {
  graph: boolean;
  hash: boolean;
  author: boolean;
  time: boolean;
}

export const DEFAULT_COLUMNS: ColumnFlags = {
  graph: true,
  hash: true,
  author: true,
  time: true,
};

interface Props {
  commits: Commit[];
  columns: ColumnFlags;
  isSelected: (hash: string) => boolean;
  onItemClick: (hash: string, event: MouseEvent) => void;
  onItemContextMenu: (hash: string, event: MouseEvent) => void;
}

const LANE_W = 12;

export function CommitList({
  commits,
  columns,
  isSelected,
  onItemClick,
  onItemContextMenu,
}: Props) {
  const { rows, maxLanes } = useMemo(() => layoutCommits(commits), [commits]);

  if (commits.length === 0) {
    return <div className="empty-hint">暂无 commit</div>;
  }

  const gridTemplate = [
    columns.graph ? `${maxLanes * LANE_W}px` : null,
    columns.hash ? '70px' : null,
    '1fr',
    columns.author ? '100px' : null,
    columns.time ? '80px' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const style = { '--commit-cols': gridTemplate } as CSSProperties;

  return (
    <div className="commit-list" style={style}>
      {commits.map((c, i) => (
        <CommitItem
          key={c.hash}
          commit={c}
          columns={columns}
          graphRow={rows[i]!}
          maxLanes={maxLanes}
          selected={isSelected(c.hash)}
          onClick={onItemClick}
          onContextMenu={onItemContextMenu}
        />
      ))}
    </div>
  );
}
