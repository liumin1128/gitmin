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
