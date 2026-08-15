import {
  WORKBENCH_VIEW_IDS,
  WORKBENCH_VIEW_METADATA,
  type WorkbenchViewId,
} from '../../../shared/workbenchViews';
import { t } from '../../../shared/i18n';
import type { WorkbenchViewState } from '../utils/workbenchLayout';
import { CheckedMenu } from './CheckedMenu';

interface Props {
  views: Record<WorkbenchViewId, WorkbenchViewState>;
  onVisibleChange: (id: WorkbenchViewId, visible: boolean) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ViewVisibilityMenu({
  views,
  onVisibleChange,
  open,
  onOpenChange,
}: Props) {
  const options = WORKBENCH_VIEW_IDS.map((id) => ({
    key: id,
    label: t(WORKBENCH_VIEW_METADATA[id].labelKey),
    checked: views[id].visible,
  }));

  return (
    <CheckedMenu
      title={t('panel.manageViews')}
      className="view-visibility-menu"
      options={options}
      onChange={onVisibleChange}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
