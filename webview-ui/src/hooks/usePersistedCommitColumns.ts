import { useCallback, useState } from 'react';
import {
  parsePersistedCommitColumns,
  type CommitColumnFlags,
} from '../../../shared/commitColumns';
import type { PersistedWebviewState } from '../utils/persistedWebviewState';
import { getWebviewState, postMessage, setWebviewState, useIpcListener } from './useIpc';

function persistWebviewColumns(columns: CommitColumnFlags): void {
  const persisted = getWebviewState<PersistedWebviewState>() ?? {};
  setWebviewState({ ...persisted, commitColumns: columns });
}

export function usePersistedCommitColumns() {
  const [columns, setColumnsState] = useState(() =>
    parsePersistedCommitColumns(
      getWebviewState<PersistedWebviewState>()?.commitColumns
    )
  );

  useIpcListener('columns/restored', (message) => {
    const restored = parsePersistedCommitColumns(message.columns);
    setColumnsState(restored);
    persistWebviewColumns(restored);
  });

  const setColumns = useCallback((next: CommitColumnFlags) => {
    const columnsToPersist = parsePersistedCommitColumns(next);
    setColumnsState(columnsToPersist);
    persistWebviewColumns(columnsToPersist);
    postMessage({ type: 'columns/update', columns: columnsToPersist });
  }, []);

  return { columns, setColumns };
}
