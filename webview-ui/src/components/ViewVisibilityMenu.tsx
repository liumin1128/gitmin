import { CheckedMenuItem } from './CheckedMenuItem';
import { FilterDropdown } from './FilterDropdown';

interface Props {
  commitsVisible: boolean;
  filesVisible: boolean;
  detailsVisible: boolean;
  onCommitsVisibleChange: (visible: boolean) => void;
  onFilesVisibleChange: (visible: boolean) => void;
  onDetailsVisibleChange: (visible: boolean) => void;
}

export function ViewVisibilityMenu({
  commitsVisible,
  filesVisible,
  detailsVisible,
  onCommitsVisibleChange,
  onFilesVisibleChange,
  onDetailsVisibleChange,
}: Props) {
  return (
    <FilterDropdown
      label={<span className="codicon codicon-more" aria-hidden="true" />}
      title="管理视图"
      hideCaret
      className="view-visibility-menu"
    >
      {() => (
        <div className="filter-list" role="menu">
          <CheckedMenuItem checked={commitsVisible} onChange={onCommitsVisibleChange}>
            提交
          </CheckedMenuItem>
          <CheckedMenuItem checked={filesVisible} onChange={onFilesVisibleChange}>
            更改的文件
          </CheckedMenuItem>
          <CheckedMenuItem checked={detailsVisible} onChange={onDetailsVisibleChange}>
            Commit 详细信息
          </CheckedMenuItem>
        </div>
      )}
    </FilterDropdown>
  );
}
