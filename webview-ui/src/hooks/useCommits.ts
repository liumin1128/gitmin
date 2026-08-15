/**
 * Commit list data hook: owns commit page state, IPC subscriptions and
 * pagination orchestration. UI stays in App/components; selection clearing is
 * delegated through a ref to avoid a circular dependency with useMultiSelect.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Commit, CommitFilters } from '../../../shared/domain';
import { COMMIT_PAGE_SIZE } from '../../../shared/commitPagination';
import { postMessage, useIpcListener } from './useIpc';
import {
  completeCommitPage,
  failCommitPage,
  loadNextCommitPage,
  mergeCommitPage,
  queueCommitReset,
  resetCommitPage,
  retryFailedCommitPage,
  settleInitialCommitLoad,
  startCommitPageSession,
  type CommitPaginationRefs,
  type InitialCommitLoadGate,
} from '../utils/commitPaging';

interface Options {
  filters: CommitFilters;
  /** Invoked before every reset; App wires it to the commit multi-select clear */
  clearSelectionRef: { current: () => void };
  /** Invoked when a page loads successfully; App wires it to clear the action error */
  onLoaded: () => void;
}

export function useCommits({ filters, clearSelectionRef, onLoaded }: Options) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [commitPageError, setCommitPageError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const nextOffsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const pendingOffsetRef = useRef<number | null>(null);
  const failedOffsetRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const queuedFiltersRef = useRef<CommitFilters | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const pagination = useMemo<CommitPaginationRefs>(
    () => ({ requestIdRef, nextOffsetRef, loadingMoreRef, pendingOffsetRef }),
    []
  );
  const gate = useMemo<InitialCommitLoadGate>(
    () => ({ settledRef, queuedFiltersRef }),
    []
  );

  const resetDirect = useCallback(
    (nextFilters: CommitFilters) => {
      clearSelectionRef.current();
      resetCommitPage(pagination, nextFilters, postMessage, () => {
        setCommits([]);
        setHasMore(true);
        setLoadingMore(false);
        failedOffsetRef.current = null;
        setCommitPageError(null);
      });
    },
    [clearSelectionRef, pagination]
  );

  const resetCommits = useCallback(
    (nextFilters: CommitFilters) => {
      queueCommitReset(gate, nextFilters, resetDirect);
    },
    [gate, resetDirect]
  );

  useIpcListener('commits/loaded', (m) => {
    if (!completeCommitPage(pagination, m.page)) return;

    setCommits((current) => mergeCommitPage(current, m.page));
    setHasMore(m.page.hasMore);
    setLoadingMore(false);
    failedOffsetRef.current = null;
    setCommitPageError(null);
    onLoadedRef.current();
    settleInitialCommitLoad(gate, resetDirect);
  });
  useIpcListener('commits/error', (m) => {
    const failedOffset = failCommitPage(pagination, m.requestId);
    if (failedOffset === null) return;

    failedOffsetRef.current = failedOffset;
    setLoadingMore(false);
    setCommitPageError(m.error);
    settleInitialCommitLoad(gate, resetDirect);
  });

  // Initial handshake: the extension answers webview/ready with the first page
  useEffect(() => {
    const requestId = startCommitPageSession(pagination);
    postMessage({
      type: 'webview/ready',
      requestId,
      limit: COMMIT_PAGE_SIZE,
      filters: filtersRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNextPage = useCallback(() => {
    if (loadNextCommitPage(pagination, hasMore, filtersRef.current, postMessage)) {
      setLoadingMore(true);
      failedOffsetRef.current = null;
      setCommitPageError(null);
    }
  }, [hasMore, pagination]);

  const retryFailedPage = useCallback(() => {
    if (retryFailedCommitPage(pagination, failedOffsetRef, filtersRef.current, postMessage)) {
      setLoadingMore(true);
      setCommitPageError(null);
    }
  }, [pagination]);

  /** Resets the commit session when the selected repository changes */
  const handleRepositorySelection = useCallback(
    (rootPath: string | null) => {
      const requestId = startCommitPageSession(pagination);
      setCommits([]);
      setHasMore(true);
      setLoadingMore(Boolean(rootPath));
      setCommitPageError(null);
      failedOffsetRef.current = null;
      settledRef.current = false;
      queuedFiltersRef.current = null;
      if (rootPath) {
        postMessage({ type: 'repositories/load', requestId, limit: COMMIT_PAGE_SIZE });
      } else {
        loadingMoreRef.current = false;
        pendingOffsetRef.current = null;
      }
    },
    [pagination]
  );

  return {
    commits,
    hasMore,
    loadingMore,
    commitPageError,
    resetCommits,
    loadNextPage,
    retryFailedPage,
    handleRepositorySelection,
  };
}
