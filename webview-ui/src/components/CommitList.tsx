/**
 * commit 列表容器：只负责渲染 + 事件冒泡
 * 多选状态由父组件通过 useMultiSelect 提供
 * 图布局由 layoutCommits 一次算出，配 CSS var 让整列 grid 对齐
 */
import { useMemo, type CSSProperties, type MouseEvent } from 'react';
import type { Commit } from '../../../shared/domain';
import { layoutCommits } from '../utils/commitGraph';
import { CommitItem } from './CommitItem';

interface Props {
  commits: Commit[];
  isSelected: (hash: string) => boolean;
  onItemClick: (hash: string, event: MouseEvent) => void;
  onItemContextMenu: (hash: string, event: MouseEvent) => void;
}

const LANE_W = 12;

export function CommitList({ commits, isSelected, onItemClick, onItemContextMenu }: Props) {
  const { rows, maxLanes } = useMemo(() => layoutCommits(commits), [commits]);

  if (commits.length === 0) {
    return <div className="empty-hint">暂无 commit</div>;
  }

  const style = { '--graph-width': `${maxLanes * LANE_W}px` } as CSSProperties;

  return (
    <div className="commit-list" style={style}>
      {commits.map((c, i) => (
        <CommitItem
          key={c.hash}
          commit={c}
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
