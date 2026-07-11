/**
 * Git history modification action enum
 * Standalone file, decoupled from message protocol
 */

export type GitAction =
  | 'copy-hash'
  | 'revert'
  | 'squash'
  | 'drop'
  | 'reset-soft'
  | 'reset-mixed'
  | 'reset-hard';

export const ACTION_LABEL: Record<GitAction, string> = {
  'copy-hash': 'Copy Hash',
  revert: 'Revert',
  squash: 'Squash',
  drop: 'Drop',
  'reset-soft': 'Reset --soft to here',
  'reset-mixed': 'Reset --mixed to here',
  'reset-hard': 'Reset --hard to here',
};

/** Check if an action is available given the current selection */
export function canPerform(
  action: GitAction,
  selectedCount: number,
  contiguous: boolean
): boolean {
  if (selectedCount === 0) return false;
  switch (action) {
    case 'copy-hash':
    case 'revert':
    case 'drop':
      return true;
    case 'squash':
      return selectedCount >= 2 && contiguous;
    case 'reset-soft':
    case 'reset-mixed':
    case 'reset-hard':
      return selectedCount === 1;
  }
}
