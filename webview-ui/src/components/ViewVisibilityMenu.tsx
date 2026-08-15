import {
  WORKBENCH_VIEW_IDS,
  WORKBENCH_VIEW_METADATA,
  type WorkbenchViewId,
} from '../../../shared/workbenchViews';
import { t } from '../../../shared/i18n';
import type { WorkbenchViewState } from '../utils/workbenchLayout';
import { CheckedMenuItem } from './CheckedMenuItem';
import { FilterDropdown } from './FilterDropdown';

interface Props {
  views: Record<WorkbenchViewId, WorkbenchViewState>;
  onVisibleChange: (id: WorkbenchViewId, visible: boolean) => void;
}

export function ViewVisibilityMenu({ views, onVisibleChange }: Props) {
  return (
    <FilterDropdown
      label={<span className="codicon codicon-more" aria-hidden="true" />}
      title={t('panel.manageViews')}
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
              {t(WORKBENCH_VIEW_METADATA[id].labelKey)}
            </CheckedMenuItem>
          ))}
        </div>
      )}
    </FilterDropdown>
  );
}
