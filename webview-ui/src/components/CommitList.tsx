/**
 * commit 列表容器：只负责渲染 + 事件冒泡
 * 多选状态由父组件通过 useMultiSelect 提供
 */
import type { MouseEvent } from 'react';
import type { Commit } from '../../../shared/domain';
import { CommitItem } from './CommitItem';

interface Props {
  commits: Commit[];
  isSelected: (hash: string) => boolean;
  onItemClick: (hash: string, event: MouseEvent) => void;
}

export function CommitList({ commits, isSelected, onItemClick }: Props) {
  if (commits.length === 0) {
    return <div className="empty-hint">暂无 commit</div>;
  }
  return (
    <div className="commit-list">
      {commits.map((c) => (
        <CommitItem
          key={c.hash}
          commit={c}
          selected={isSelected(c.hash)}
          onClick={onItemClick}
        />
      ))}
    </div>
  );
}
