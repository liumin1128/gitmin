import { useCallback, useMemo, useRef, useState } from 'react';
import type { WorkingTreeGroup, WorkingTreeSnapshot } from '../../../shared/domain';
import {
  canCommit,
  canGenerateCommitMessage,
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
  const [generating, setGenerating] = useState(false);
  const loadRequestIdRef = useRef(0);
  const actionRequestIdRef = useRef(0);
  const generationRequestIdRef = useRef(0);
  const itemKeys = useMemo(
    () => [
      ...snapshot.conflicts.map((item) => workingTreeChangeKey('conflicts', item.path)),
      ...snapshot.staged.map((item) => workingTreeChangeKey('staged', item.path)),
      ...snapshot.changes.map((item) => workingTreeChangeKey('changes', item.path)),
    ],
    [snapshot]
  );
  const selection = useMultiSelect(itemKeys);

  const applySnapshot = useCallback(
    (nextSnapshot: WorkingTreeSnapshot) => {
      setSnapshot(nextSnapshot);
      setLoading(false);
      selection.clear();
    },
    [selection.clear]
  );

  const refresh = useCallback(() => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    postMessage({ type: 'workingTree/request', requestId });
  }, []);

  useIpcListener('repo/info', refresh);
  useIpcListener('repositories/selectionChanged', () => {
    loadRequestIdRef.current += 1;
    actionRequestIdRef.current += 1;
    generationRequestIdRef.current += 1;
    setSnapshot(EMPTY_SNAPSHOT);
    setMessage('');
    setLoading(false);
    setBusy(false);
    setGenerating(false);
    selection.clear();
  });
  useIpcListener('workingTree/changed', (response) => {
    applySnapshot(response.snapshot);
  });
  useIpcListener('workingTree/loaded', (response) => {
    if (response.requestId !== loadRequestIdRef.current) return;
    applySnapshot(response.snapshot);
  });
  useIpcListener('workingTree/error', (response) => {
    if (response.requestId !== loadRequestIdRef.current) return;
    setLoading(false);
  });
  useIpcListener('workingTree/actionResult', (response) => {
    if (!['stage', 'unstage', 'discard', 'commit', 'stash'].includes(response.operation)) return;
    if (response.requestId !== actionRequestIdRef.current) return;
    setBusy(false);
    if (response.ok) {
      if (response.operation === 'commit' || response.operation === 'stash') setMessage('');
    }
    if (response.refresh.includes('changes')) refresh();
    if (response.refresh.includes('commits')) onRefreshCommits();
    if (response.refresh.includes('stashes')) onRefreshStashes();
  });
  useIpcListener('workingTree/commitMessageResult', (response) => {
    if (response.requestId !== generationRequestIdRef.current) return;
    setGenerating(false);
    if (response.ok) setMessage(response.message ?? '');
  });

  const nextActionId = useCallback(() => {
    setBusy(true);
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

  const generateCommitMessage = useCallback(() => {
    const requestId = ++generationRequestIdRef.current;
    setGenerating(true);
    postMessage({ type: 'workingTree/generateCommitMessage', requestId });
  }, []);

  const stash = useCallback(() => {
    postMessage({ type: 'workingTree/stash', requestId: nextActionId(), message });
  }, [message, nextActionId]);

  const openDiff = useCallback((group: WorkingTreeGroup, path: string) => {
    postMessage({ type: 'workingTree/openDiff', group, path });
  }, []);

  const updateMessage = useCallback((nextMessage: string) => setMessage(nextMessage), []);

  return {
    snapshot,
    message,
    loading,
    busy,
    generating,
    selectedKeys: selection.selected,
    commitEnabled: canCommit(message, snapshot),
    generateEnabled: canGenerateCommitMessage(snapshot),
    stashEnabled: canStash(snapshot),
    setMessage: updateMessage,
    onSelect: selection.onItemClick,
    runAction,
    commit,
    generateCommitMessage,
    stash,
    refresh,
    openDiff,
  };
}
