/**
 * Right-click context menu (pure UI)
 * Parent decides when to open, providing position and selection state; item clicks dispatch action upward
 */
import { Fragment } from 'react';
import type { GitAction } from '../../../shared/actions';
import { canPerform } from '../../../shared/actions';
import { t, type TranslationKey } from '../../../shared/i18n';

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
const ACTION_LABEL_KEYS: Record<GitAction, TranslationKey> = {
  'copy-hash': 'action.copyHash',
  revert: 'action.revert',
  squash: 'action.squash',
  drop: 'action.drop',
  'reset-soft': 'action.resetSoft',
  'reset-mixed': 'action.resetMixed',
  'reset-hard': 'action.resetHard',
};

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
              {t(ACTION_LABEL_KEYS[action])}
              {suffix}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
