import { useCallback, useState } from 'react';
import { getWebviewState, setWebviewState } from './useIpc';
import {
  parseWorkbenchLayout,
  setWorkbenchPanelHeight,
  setViewCollapsed,
  setViewVisible,
  type WorkbenchLayoutState,
  type WorkbenchViewId,
} from '../utils/workbenchLayout';
import type { PersistedWebviewState } from '../utils/persistedWebviewState';

type LayoutUpdate = (current: WorkbenchLayoutState) => WorkbenchLayoutState;

export function useWorkbenchLayout() {
  const [layout, setLayout] = useState(() =>
    parseWorkbenchLayout(getWebviewState<PersistedWebviewState>()?.workbenchLayout)
  );

  const update = useCallback((transform: LayoutUpdate) => {
    setLayout((current) => {
      const next = transform(current);
      const persisted = getWebviewState<PersistedWebviewState>() ?? {};
      setWebviewState({ ...persisted, workbenchLayout: next });
      return next;
    });
  }, []);

  const setPanelHeight = useCallback(
    (id: WorkbenchViewId, height: number | null) =>
      update((current) => setWorkbenchPanelHeight(current, id, height)),
    [update]
  );
  const setVisible = useCallback(
    (id: WorkbenchViewId, visible: boolean) =>
      update((current) => setViewVisible(current, id, visible)),
    [update]
  );
  const setCollapsed = useCallback(
    (id: WorkbenchViewId, collapsed: boolean) =>
      update((current) => setViewCollapsed(current, id, collapsed)),
    [update]
  );

  return {
    layout,
    setPanelHeight,
    setVisible,
    setCollapsed,
  };
}
