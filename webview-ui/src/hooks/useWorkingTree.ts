import { useCallback, useMemo, useRef, useState } from 'react';
import type { WorkingTreeGroup, WorkingTreeSnapshot } from '../../../shared/domain';
import {
  canCommit,
  canStash,
  workingTreeChangeKey,
  type WorkingTreeAction,
} from '../../../shared/workingTree';
import { postMessage, useIpcListener } from './useIpc';
import { useMultiSelect } from './useMultiSelect';

const EMPTY_SNAPSHOT: WorkingTreeSnapshot = {
  conflicts: [],
  staged: [],
  changes: [],
};

interface Options {
  onRefreshCommits: () => void;
  onRefreshStashes: () => void;
}

export function useWorkingTree({ onRefreshCommits, onRefreshStashes }: Options) {
  const [snapshot, setSnapshot] = useState<WorkingTreeSnapshot>(EMPTY_SNAPSHOT);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const actionRequestIdRef = useRef(0);
  const itemKeys = useMemo(
    () => [
      ...snapshot.conflicts.map((item) => workingTreeChangeKey('conflicts', item.path)),
      ...snapshot.staged.map((item) => workingTreeChangeKey('staged', item.path)),
      ...snapshot.changes.map((item) => workingTreeChangeKey('changes', item.path)),
    ],
    [snapshot]
  );
  const selection = useMultiSelect(itemKeys);

  const refresh = useCallback(() => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setError(null);
    postMessage({ type: 'workingTree/request', requestId });
  }, []);

  useIpcListener('repo/info', refresh);
  useIpcListener('repositories/selectionChanged', () => {
    loadRequestIdRef.current += 1;
    actionRequestIdRef.current += 1;
    setSnapshot(EMPTY_SNAPSHOT);
    setMessage('');
    setLoading(false);
    setBusy(false);
    setError(null);
    setNotice(null);
    selection.clear();
  });
  useIpcListener('workingTree/changed', refresh);
  useIpcListener('workingTree/loaded', (response) => {
    if (response.requestId !== loadRequestIdRef.current) return;
    setSnapshot(response.snapshot);
    setLoading(false);
    setError(null);
    selection.clear();
  });
  useIpcListener('workingTree/error', (response) => {
    if (response.requestId !== loadRequestIdRef.current) return;
    setLoading(false);
    setError(response.error);
  });
  useIpcListener('workingTree/actionResult', (response) => {
    if (!['stage', 'unstage', 'discard', 'commit', 'stash'].includes(response.operation)) return;
    if (response.requestId !== actionRequestIdRef.current) return;
    setBusy(false);
    if (!response.ok) {
      setNotice(null);
      if (response.message !== 'Cancelled') setError(response.message ?? 'Operation failed');
    } else {
      setError(null);
      if (response.operation === 'commit' || response.operation === 'stash') setMessage('');
      setNotice(response.operation === 'stash' ? response.message ?? 'Changes stashed' : null);
    }
    if (response.refresh.includes('changes')) refresh();
    if (response.refresh.includes('commits')) onRefreshCommits();
    if (response.refresh.includes('stashes')) onRefreshStashes();
  });

  const nextActionId = useCallback(() => {
    setBusy(true);
    setError(null);
    setNotice(null);
    return ++actionRequestIdRef.current;
  }, []);

  const runAction = useCallback(
    (action: WorkingTreeAction, group: WorkingTreeGroup, paths: string[]) => {
      postMessage({
        type: 'workingTree/action',
        requestId: nextActionId(),
        action,
        group,
        paths,
      });
    },
    [nextActionId]
  );

  const commit = useCallback(() => {
    postMessage({ type: 'workingTree/commit', requestId: nextActionId(), message });
  }, [message, nextActionId]);

  const stash = useCallback(() => {
    postMessage({ type: 'workingTree/stash', requestId: nextActionId(), message });
  }, [message, nextActionId]);

  const openDiff = useCallback((group: WorkingTreeGroup, path: string) => {
    postMessage({ type: 'workingTree/openDiff', group, path });
  }, []);

  const updateMessage = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
    setNotice(null);
  }, []);

  return {
    snapshot,
    message,
    loading,
    busy,
    error,
    notice,
    selectedKeys: selection.selected,
    commitEnabled: canCommit(message, snapshot),
    stashEnabled: canStash(snapshot),
    setMessage: updateMessage,
    onSelect: selection.onItemClick,
    runAction,
    commit,
    stash,
    refresh,
    openDiff,
  };
}
