import { FilterDropdown } from './FilterDropdown';

interface Props {
  commitsVisible: boolean;
  filesVisible: boolean;
  onCommitsVisibleChange: (visible: boolean) => void;
  onFilesVisibleChange: (visible: boolean) => void;
}

export function ViewVisibilityMenu({
  commitsVisible,
  filesVisible,
  onCommitsVisibleChange,
  onFilesVisibleChange,
}: Props) {
  return (
    <FilterDropdown
      label="⋯"
      title="管理视图"
      hideCaret
      className="view-visibility-menu"
    >
      {() => (
        <div className="filter-list">
          <label className="filter-check">
            <input
              type="checkbox"
              checked={commitsVisible}
              onChange={(event) => onCommitsVisibleChange(event.target.checked)}
            />
            <span>提交</span>
          </label>
          <label className="filter-check">
            <input
              type="checkbox"
              checked={filesVisible}
              onChange={(event) => onFilesVisibleChange(event.target.checked)}
            />
            <span>更改的文件</span>
          </label>
        </div>
      )}
    </FilterDropdown>
  );
}
