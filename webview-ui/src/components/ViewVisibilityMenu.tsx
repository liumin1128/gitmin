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
      title="Manage views"
      hideCaret
      className="view-visibility-menu"
    >
      {() => (
        <div className="filter-list" role="menu">
          <CheckedMenuItem checked={commitsVisible} onChange={onCommitsVisibleChange}>
            Commits
          </CheckedMenuItem>
          <CheckedMenuItem checked={filesVisible} onChange={onFilesVisibleChange}>
            Changed Files
          </CheckedMenuItem>
          <CheckedMenuItem checked={detailsVisible} onChange={onDetailsVisibleChange}>
            Commit Details
          </CheckedMenuItem>
        </div>
      )}
    </FilterDropdown>
  );
}
