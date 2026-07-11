/**
 * Right-click context menu (pure UI)
 * Parent decides when to open, providing position and selection state; item clicks dispatch action upward
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

/** Menu item order + separator positions */
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
