/**
 * 右键上下文菜单（纯 UI）
 * 由父组件决定何时打开、传入位置与选中状态；点击项时向上派发 action
 */
import { Fragment } from 'react';
import type { GitAction } from '../../../shared/actions';
import { ACTION_LABEL, canPerform } from '../../../shared/actions';

interface Props {
  x: number;
  y: number;
  selectedCount: number;
  contiguous: boolean;
  onSelect: (action: GitAction) => void;
}

/** 菜单项顺序 + 分割线位置 */
const ORDER: GitAction[] = [
  'copy-hash',
  'revert',
  'squash',
  'drop',
  'reset-soft',
  'reset-mixed',
  'reset-hard',
];
const SEPARATOR_BEFORE = new Set<GitAction>(['reset-soft']);

export function CommitContextMenu({ x, y, selectedCount, contiguous, onSelect }: Props) {
  return (
    <div
      className="ctx-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {ORDER.map((action) => {
        const enabled = canPerform(action, selectedCount, contiguous);
        const suffix =
          enabled && selectedCount > 1 && (action === 'revert' || action === 'drop')
            ? ` (${selectedCount})`
            : '';
        return (
          <Fragment key={action}>
            {SEPARATOR_BEFORE.has(action) && <div className="ctx-sep" />}
            <button
              type="button"
              className="ctx-item"
              disabled={!enabled}
              onClick={() => enabled && onSelect(action)}
            >
              {ACTION_LABEL[action]}
              {suffix}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
