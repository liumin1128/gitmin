import { useCallback, useRef, useState } from 'react';
import type { StashEntry } from '../../../shared/domain';
import { postMessage, useIpcListener } from './useIpc';

interface Options {
  onSelectionChange: (entry: StashEntry | null) => void;
  onRefreshChanges: () => void;
}

export function useStashes({ onSelectionChange, onRefreshChanges }: Options) {
  const [entries, setEntries] = useState<StashEntry[]>([]);
  const [selected, setSelected] = useState<StashEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const actionRequestIdRef = useRef(0);
  const selectedRef = useRef<StashEntry | null>(null);
  selectedRef.current = selected;

  const refresh = useCallback(() => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setError(null);
    postMessage({ type: 'stashes/request', requestId });
  }, []);

  const clearSelection = useCallback(() => {
    selectedRef.current = null;
    setSelected(null);
    onSelectionChange(null);
  }, [onSelectionChange]);

  const select = useCallback(
    (entry: StashEntry) => {
      selectedRef.current = entry;
      setSelected(entry);
      onSelectionChange(entry);
    },
    [onSelectionChange]
  );

  useIpcListener('repo/info', refresh);
  useIpcListener('stashes/loaded', (response) => {
    if (response.requestId !== loadRequestIdRef.current) return;
    setEntries(response.entries);
    setLoading(false);
    setError(null);
    const current = selectedRef.current;
    if (!current) return;
    const next = response.entries.find((entry) => entry.hash === current.hash) ?? null;
    if (!next) {
      clearSelection();
    } else if (next.selector !== current.selector) {
      select(next);
    }
  });
  useIpcListener('stashes/error', (response) => {
    if (response.requestId !== loadRequestIdRef.current) return;
    setLoading(false);
    setError(response.error);
  });
  useIpcListener('workingTree/actionResult', (response) => {
    if (response.operation !== 'apply-stash' && response.operation !== 'delete-stash') return;
    if (response.requestId !== actionRequestIdRef.current) return;
    setBusy(false);
    if (!response.ok) {
      if (response.message !== 'Cancelled') setError(response.message ?? 'Operation failed');
    } else {
      setError(null);
      if (response.operation === 'delete-stash') clearSelection();
    }
    if (response.refresh.includes('changes')) onRefreshChanges();
    if (response.refresh.includes('stashes')) refresh();
  });

  const runAction = useCallback(
    (action: 'apply' | 'delete') => {
      const entry = selectedRef.current;
      if (!entry) return;
      setBusy(true);
      setError(null);
      postMessage({
        type: 'stashes/action',
        requestId: ++actionRequestIdRef.current,
        action,
        selector: entry.selector,
        hash: entry.hash,
      });
    },
    []
  );

  return {
    entries,
    selected,
    loading,
    busy,
    error,
    refresh,
    select,
    clearSelection,
    apply: () => runAction('apply'),
    deleteSelected: () => runAction('delete'),
  };
}
