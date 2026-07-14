import type {
  WorkbenchViewId,
  WorkbenchViewState,
} from '../utils/workbenchLayout';
import { ViewVisibilityMenu } from './ViewVisibilityMenu';

interface Props {
  views: Record<WorkbenchViewId, WorkbenchViewState>;
  onVisibleChange: (id: WorkbenchViewId, visible: boolean) => void;
}

export function WorkbenchToolbar({ views, onVisibleChange }: Props) {
  return (
    <div className="workbench-toolbar">
      <span className="workbench-toolbar-spacer" />
      <ViewVisibilityMenu views={views} onVisibleChange={onVisibleChange} />
    </div>
  );
}
