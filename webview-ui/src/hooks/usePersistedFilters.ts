import { useCallback, useState } from 'react';
import type { CommitFilters } from '../../../shared/domain';
import { parsePersistedCommitFilters } from '../../../shared/persistedFilters';
import { getWebviewState, setWebviewState } from './useIpc';
import type { PersistedWebviewState } from '../utils/persistedWebviewState';

export function usePersistedFilters() {
  const [filters, setFiltersState] = useState(() =>
    parsePersistedCommitFilters(getWebviewState<PersistedWebviewState>()?.commitFilters)
  );

  const setFilters = useCallback((next: CommitFilters) => {
    setFiltersState(next);
    const persisted = getWebviewState<PersistedWebviewState>() ?? {};
    setWebviewState({ ...persisted, commitFilters: next });
  }, []);

  return { filters, setFilters };
}
