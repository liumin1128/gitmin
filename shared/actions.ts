/**
 * 修改历史类的操作枚举
 * 独立成文件，与消息协议分离
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
  'copy-hash': '复制 Hash',
  revert: 'Revert',
  squash: 'Squash（压缩为一个）',
  drop: 'Drop（删除）',
  'reset-soft': 'Reset --soft 到此',
  'reset-mixed': 'Reset --mixed 到此',
  'reset-hard': 'Reset --hard 到此',
};

/** 判断某 action 在当前选择下是否可用 */
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
