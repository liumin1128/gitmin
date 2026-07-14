import {
  WORKBENCH_VIEW_IDS,
  type WorkbenchViewId,
  type WorkbenchViewState,
} from '../utils/workbenchLayout';
import { CheckedMenuItem } from './CheckedMenuItem';
import { FilterDropdown } from './FilterDropdown';

const VIEW_LABEL: Record<WorkbenchViewId, string> = {
  changes: 'Changes',
  commits: 'Commits',
  stashes: 'Stashes',
  files: 'Changed Files',
  details: 'Commit Details',
};

interface Props {
  views: Record<WorkbenchViewId, WorkbenchViewState>;
  onVisibleChange: (id: WorkbenchViewId, visible: boolean) => void;
}

export function ViewVisibilityMenu({ views, onVisibleChange }: Props) {
  return (
    <FilterDropdown
      label={<span className="codicon codicon-more" aria-hidden="true" />}
      title="Manage views"
      hideCaret
      className="view-visibility-menu"
    >
      {() => (
        <div className="filter-list" role="menu">
          {WORKBENCH_VIEW_IDS.map((id) => (
            <CheckedMenuItem
              key={id}
              checked={views[id].visible}
              onChange={(visible) => onVisibleChange(id, visible)}
            >
              {VIEW_LABEL[id]}
            </CheckedMenuItem>
          ))}
        </div>
      )}
    </FilterDropdown>
  );
}
