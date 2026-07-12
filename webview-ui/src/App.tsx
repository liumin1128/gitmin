/**
 * Top-level container:
 * - Notifies extension on mount (webview/ready)
 * - Subscribes to all extension messages, manages repo/commits/diff/action state
 * - Composes useMultiSelect + useContextMenu
 * - Passes pure data and callbacks down to UI components
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { postMessage, useIpcListener } from './hooks/useIpc';
import { useMultiSelect } from './hooks/useMultiSelect';
import { useContextMenu } from './hooks/useContextMenu';
import { useWorkbenchLayout } from './hooks/useWorkbenchLayout';
import { usePersistedFilters } from './hooks/usePersistedFilters';
import { useCommitDetails } from './hooks/useCommitDetails';
import { FilterBar } from './components/FilterBar';
import { CommitList, DEFAULT_COLUMNS, type ColumnFlags } from './components/CommitList';
import { ColumnsMenu } from './components/ColumnsMenu';
import { ChangedFilesPanel } from './components/ChangedFilesPanel';
import { CommitDetailsPanel } from './components/CommitDetailsPanel';
import { CommitContextMenu } from './components/CommitContextMenu';
import { SquashModal } from './components/SquashModal';
import { ResizablePanelStack } from './components/ResizablePanelStack';
import { ViewSection } from './components/ViewSection';
import { ViewVisibilityMenu } from './components/ViewVisibilityMenu';
import { getWorkbenchPaneSizes } from './utils/workbenchLayout';
import { shouldPreserveUnresolvedParents } from './utils/commitGraph';
import { COMMIT_PAGE_SIZE, type CommitPage } from '../../shared/commitPagination';
import type {
  Commit,
  CommitFilters,
  DiffRange,
  FileChange,
  FilterOptions,
} from '../../shared/domain';
import type { WebviewMessage } from '../../shared/messages';
import type { GitAction } from '../../shared/actions';

type CommitPageRequest = Extract<WebviewMessage, { type: 'commits/refresh' }>;

interface CommitPaginationRefs {
  requestIdRef: { current: number };
  nextOffsetRef: { current: number };
  loadingMoreRef: { current: boolean };
  pendingOffsetRef: { current: number | null };
}

interface InitialCommitLoadGate {
  settledRef: { current: boolean };
  queuedFiltersRef: { current: CommitFilters | null };
}

type PostCommitPageRequest = (request: CommitPageRequest) => void;

export function mergeCommitPage(commits: Commit[], page: CommitPage): Commit[] {
  return page.offset === 0 ? page.commits : [...commits, ...page.commits];
}

function startCommitPageSession(pagination: CommitPaginationRefs): number {
  pagination.requestIdRef.current += 1;
  pagination.nextOffsetRef.current = 0;
  pagination.loadingMoreRef.current = true;
  pagination.pendingOffsetRef.current = 0;
  return pagination.requestIdRef.current;
}

export function requestCommitPage(
  requestId: number,
  offset: number,
  filters: CommitFilters,
  post: PostCommitPageRequest
): void {
  post({ type: 'commits/refresh', requestId, offset, limit: COMMIT_PAGE_SIZE, filters });
}

export function resetCommitPage(
  pagination: CommitPaginationRefs,
  filters: CommitFilters,
  post: PostCommitPageRequest,
  beforeRequest: () => void = () => undefined
): number {
  const requestId = startCommitPageSession(pagination);
  beforeRequest();
  requestCommitPage(requestId, 0, filters, post);
  return requestId;
}

export function loadNextCommitPage(
  pagination: CommitPaginationRefs,
  hasMore: boolean,
  filters: CommitFilters,
  post: PostCommitPageRequest
): boolean {
  if (pagination.loadingMoreRef.current || !hasMore) return false;

  pagination.loadingMoreRef.current = true;
  pagination.pendingOffsetRef.current = pagination.nextOffsetRef.current;
  requestCommitPage(
    pagination.requestIdRef.current,
    pagination.nextOffsetRef.current,
    filters,
    post
  );
  return true;
}

export function completeCommitPage(pagination: CommitPaginationRefs, page: CommitPage): boolean {
  if (
    page.requestId !== pagination.requestIdRef.current ||
    page.offset !== pagination.pendingOffsetRef.current
  ) {
    return false;
  }

  pagination.nextOffsetRef.current = page.nextOffset;
  pagination.pendingOffsetRef.current = null;
  pagination.loadingMoreRef.current = false;
  return true;
}

export function failCommitPage(
  pagination: CommitPaginationRefs,
  requestId: number
): number | null {
  if (requestId !== pagination.requestIdRef.current || pagination.pendingOffsetRef.current === null) {
    return null;
  }

  const failedOffset = pagination.pendingOffsetRef.current;
  pagination.pendingOffsetRef.current = null;
  pagination.loadingMoreRef.current = false;
  return failedOffset;
}

export function retryFailedCommitPage(
  pagination: CommitPaginationRefs,
  failedOffsetRef: { current: number | null },
  filters: CommitFilters,
  post: PostCommitPageRequest
): boolean {
  const failedOffset = failedOffsetRef.current;
  if (pagination.loadingMoreRef.current || failedOffset === null) return false;

  pagination.loadingMoreRef.current = true;
  pagination.pendingOffsetRef.current = failedOffset;
  failedOffsetRef.current = null;
  requestCommitPage(pagination.requestIdRef.current, failedOffset, filters, post);
  return true;
}

export function queueCommitReset(
  gate: InitialCommitLoadGate,
  filters: CommitFilters,
  dispatchReset: (filters: CommitFilters) => void
): boolean {
  if (!gate.settledRef.current) {
    gate.queuedFiltersRef.current = filters;
    return false;
  }

  dispatchReset(filters);
  return true;
}

export function settleInitialCommitLoad(
  gate: InitialCommitLoadGate,
  dispatchReset: (filters: CommitFilters) => void
): void {
  if (gate.settledRef.current) return;

  gate.settledRef.current = true;
  const filters = gate.queuedFiltersRef.current;
  gate.queuedFiltersRef.current = null;
  if (filters) dispatchReset(filters);
}

export function App() {
  const [repoError, setRepoError] = useState<string | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [commitPageError, setCommitPageError] = useState<string | null>(null);
  const [range, setRange] = useState<DiffRange | null>(null);
  const [files, setFiles] = useState<FileChange[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [squashHashes, setSquashHashes] = useState<string[] | null>(null);
  const { filters, setFilters } = usePersistedFilters();
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    branches: [],
    authors: [],
  });
  const [columns, setColumns] = useState<ColumnFlags>(DEFAULT_COLUMNS);
  const { layout, setPaneSizes, setVisible, setCollapsed } = useWorkbenchLayout();
  const filtersReadyRef = useRef(false);
  const restoringFiltersRef = useRef(false);
  const commitRequestIdRef = useRef(0);
  const nextCommitOffsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const pendingCommitOffsetRef = useRef<number | null>(null);
  const failedCommitOffsetRef = useRef<number | null>(null);
  const initialCommitLoadSettledRef = useRef(false);
  const queuedCommitResetFiltersRef = useRef<CommitFilters | null>(null);
  const dispatchResetRef = useRef<(filters: CommitFilters) => void>(() => undefined);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const pagination = {
    requestIdRef: commitRequestIdRef,
    nextOffsetRef: nextCommitOffsetRef,
    loadingMoreRef,
    pendingOffsetRef: pendingCommitOffsetRef,
  };
  const initialLoadGate = {
    settledRef: initialCommitLoadSettledRef,
    queuedFiltersRef: queuedCommitResetFiltersRef,
  };

  // === Message subscriptions ===
  useIpcListener('repo/info', () => {
    setRepoError(null);
  });
  useIpcListener('repo/none', (m) => {
    setRepoError(m.reason);
  });
  useIpcListener('commits/loaded', (m) => {
    if (!completeCommitPage(pagination, m.page)) return;

    setCommits((current) => mergeCommitPage(current, m.page));
    setHasMore(m.page.hasMore);
    setLoadingMore(false);
    failedCommitOffsetRef.current = null;
    setCommitPageError(null);
    setError(null);
    settleInitialCommitLoad(initialLoadGate, (filters) => dispatchResetRef.current(filters));
  });
  useIpcListener('commits/error', (m) => {
    const failedOffset = failCommitPage(pagination, m.requestId);
    if (failedOffset === null) return;

    failedCommitOffsetRef.current = failedOffset;
    setLoadingMore(false);
    setCommitPageError(m.error);
    settleInitialCommitLoad(initialLoadGate, (filters) => dispatchResetRef.current(filters));
  });
  useIpcListener('filters/restored', (m) => {
    restoringFiltersRef.current = true;
    setFilters(m.filters);
  });
  useIpcListener('filters/options', (m) => setFilterOptions(m.options));
  useIpcListener('diff/loaded', (m) => {
    setRange(m.range);
    setFiles(m.files);
    setActiveFilePath(null);
    setDiffLoading(false);
  });
  useIpcListener('diff/activeFile', (m) => setActiveFilePath(m.filePath));
  useIpcListener('diff/error', (m) => {
    setError(m.error);
    setDiffLoading(false);
  });
  // === Lifecycle: notify on mount ===
  useEffect(() => {
    const requestId = startCommitPageSession(pagination);
    postMessage({ type: 'webview/ready', requestId, limit: COMMIT_PAGE_SIZE, filters });
    // Restored filters are only used for the initial handshake; subsequent
    // filter changes trigger refresh via the useEffect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === Multi-select ===
  const commitHashes = useMemo(() => commits.map((c) => c.hash), [commits]);
  const { selected, isSelected, onItemClick, selectOnly, clear } = useMultiSelect(commitHashes);
  const commitDetails = useCommitDetails(commits, selected);

  const dispatchResetCommits = useCallback(
    (nextFilters: CommitFilters) => {
      clear();
      resetCommitPage(pagination, nextFilters, postMessage, () => {
        setCommits([]);
        setHasMore(true);
        setLoadingMore(false);
        failedCommitOffsetRef.current = null;
        setCommitPageError(null);
      });
    },
    [clear]
  );
  dispatchResetRef.current = dispatchResetCommits;

  const resetCommits = useCallback(
    (nextFilters: CommitFilters) => {
      queueCommitReset(initialLoadGate, nextFilters, dispatchResetCommits);
    },
    [dispatchResetCommits]
  );

  const loadMoreCommits = useCallback(() => {
    if (loadNextCommitPage(pagination, hasMore, filtersRef.current, postMessage)) {
      setLoadingMore(true);
      failedCommitOffsetRef.current = null;
      setCommitPageError(null);
    }
  }, [hasMore]);

  const retryFailedCommitPageRequest = useCallback(() => {
    if (retryFailedCommitPage(pagination, failedCommitOffsetRef, filtersRef.current, postMessage)) {
      setLoadingMore(true);
      setCommitPageError(null);
    }
  }, []);

  // === Filter changes → re-fetch commits (skip initial mount, handled by webview/ready) ===
  useEffect(() => {
    if (!filtersReadyRef.current) {
      filtersReadyRef.current = true;
      return;
    }
    if (restoringFiltersRef.current) {
      restoringFiltersRef.current = false;
      return;
    }
    resetCommits(filters);
  }, [filters, resetCommits]);

  useIpcListener('action/result', (m) => {
    setBusy(false);
    if (!m.ok) {
      setError(m.message ?? 'Operation failed');
      return;
    }

    setError(null);
    if (m.action !== 'copy-hash') resetCommits(filtersRef.current);
  });

  // Whether selected commits are contiguous (Squash requires)
  const contiguous = useMemo(() => {
    if (selected.size <= 1) return true;
    const indexMap = new Map(commits.map((c, i) => [c.hash, i]));
    const indices = [...selected]
      .map((h) => indexMap.get(h))
      .filter((i): i is number => i !== undefined);
    if (indices.length === 0) return true;
    const min = Math.min(...indices);
    const max = Math.max(...indices);
    return max - min + 1 === indices.length;
  }, [selected, commits]);

  // === Selection change → request diff ===
  const selectionKey = useMemo(() => [...selected].sort().join('|'), [selected]);
  useEffect(() => {
    if (selected.size === 0) {
      setRange(null);
      setFiles([]);
      setActiveFilePath(null);
      return;
    }
    setDiffLoading(true);
    postMessage({ type: 'diff/request', hashes: [...selected] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  // === Context menu ===
  const menu = useContextMenu();
  const handleContextMenu = useCallback(
    (hash: string, event: React.MouseEvent) => {
      if (!selected.has(hash)) selectOnly(hash);
      menu.open(event.clientX, event.clientY);
    },
    [selected, selectOnly, menu]
  );

  const handleActionSelect = useCallback(
    (action: GitAction) => {
      menu.close();
      if (selected.size === 0) return;
      if (action === 'squash') {
        setSquashHashes([...selected]);
        return;
      }
      setBusy(true);
      setError(null);
      postMessage({ type: 'action/execute', action, hashes: [...selected] });
    },
    [selected, menu]
  );

  const squashCommits = useMemo(() => {
    if (!squashHashes) return [];
    const hashSet = new Set(squashHashes);
    return commits.filter((c) => hashSet.has(c.hash));
  }, [squashHashes, commits]);

  const handleSquashConfirm = useCallback(
    (message: string) => {
      setSquashHashes(null);
      setBusy(true);
      setError(null);
      postMessage({
        type: 'action/execute',
        action: 'squash',
        hashes: squashHashes ?? [],
        squashMessage: message,
      });
    },
    [squashHashes]
  );

  const handleSquashCancel = useCallback(() => {
    setSquashHashes(null);
  }, []);

  const handleRefresh = useCallback(() => {
    resetCommits(filters);
    postMessage({ type: 'filters/refresh' });
  }, [filters, resetCommits]);

  const handleOpenDiff = useCallback(
    (filePath: string) => {
      if (!range) return;
      postMessage({ type: 'file/openDiff', range, filePath });
    },
    [range]
  );

  if (repoError) {
    return (
      <div className="app-empty">
        <p>{repoError}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <FilterBar
        filters={filters}
        options={filterOptions}
        onChange={setFilters}
        onRefresh={handleRefresh}
        actions={
          <ViewVisibilityMenu
            commitsVisible={layout.views.commits.visible}
            filesVisible={layout.views.files.visible}
            detailsVisible={layout.views.details.visible}
            onCommitsVisibleChange={(visible) => setVisible('commits', visible)}
            onFilesVisibleChange={(visible) => setVisible('files', visible)}
            onDetailsVisibleChange={(visible) => setVisible('details', visible)}
          />
        }
      />
      {(commitPageError ?? error) && <div className="error-bar">{commitPageError ?? error}</div>}
      {busy && <div className="busy-bar">Executing...</div>}
      <ResizablePanelStack
        sizes={getWorkbenchPaneSizes(layout)}
        onSizesChange={setPaneSizes}
        panes={[
          {
            id: 'commits',
            visible: layout.views.commits.visible,
            collapsed: layout.views.commits.collapsed,
            content: (
              <ViewSection
                id="commits"
                title="Commits"
                count={commits.length}
                visible={layout.views.commits.visible}
                collapsed={layout.views.commits.collapsed}
                onCollapsedChange={(collapsed) => setCollapsed('commits', collapsed)}
                actions={
                  <>
                    {commitPageError && (
                      <button
                        type="button"
                        className="toolbar-icon-button"
                        title="Retry loading commits"
                        aria-label="Retry loading commits"
                        onClick={retryFailedCommitPageRequest}
                      >
                        <span className="codicon codicon-refresh" aria-hidden="true" />
                      </button>
                    )}
                    <ColumnsMenu columns={columns} onChange={setColumns} />
                  </>
                }
              >
                <CommitList
                  commits={commits}
                  columns={columns}
                  isSelected={isSelected}
                  onItemClick={onItemClick}
                  onItemContextMenu={handleContextMenu}
                  hasMore={hasMore}
                  preserveUnresolvedParents={shouldPreserveUnresolvedParents(hasMore, filters)}
                  loadingMore={loadingMore}
                  automaticLoadEnabled={!commitPageError}
                  onLoadMore={loadMoreCommits}
                />
              </ViewSection>
            ),
          },
          {
            id: 'files',
            visible: layout.views.files.visible,
            collapsed: layout.views.files.collapsed,
            content: (
              <ViewSection
                id="files"
                title="Changed Files"
                count={range ? files.length : undefined}
                visible={layout.views.files.visible}
                collapsed={layout.views.files.collapsed}
                onCollapsedChange={(collapsed) => setCollapsed('files', collapsed)}
                actions={
                  range && !range.contiguous ? (
                    <span
                      className="warn-tag"
                      title="Selected commits are not contiguous; the diff range includes changes from unselected commits"
                    >
                      ⚠
                    </span>
                  ) : undefined
                }
              >
                <ChangedFilesPanel
                  range={range}
                  files={files}
                  activeFilePath={activeFilePath}
                  loading={diffLoading}
                  onOpenDiff={handleOpenDiff}
                />
              </ViewSection>
            ),
          },
          {
            id: 'details',
            visible: layout.views.details.visible,
            collapsed: layout.views.details.collapsed,
            content: (
              <ViewSection
                id="details"
                title="Commit Details"
                count={commitDetails.hashes.length}
                visible={layout.views.details.visible}
                collapsed={layout.views.details.collapsed}
                onCollapsedChange={(collapsed) => setCollapsed('details', collapsed)}
              >
                <CommitDetailsPanel
                  details={commitDetails.details}
                  loading={commitDetails.loading}
                  error={commitDetails.error}
                />
              </ViewSection>
            ),
          },
        ]}
      />
      {menu.pos && (
        <CommitContextMenu
          x={menu.pos.x}
          y={menu.pos.y}
          selectedCount={selected.size}
          contiguous={contiguous}
          onSelect={handleActionSelect}
        />
      )}
      {squashHashes && squashCommits.length > 0 && (
        <SquashModal
          commits={squashCommits}
          onConfirm={handleSquashConfirm}
          onCancel={handleSquashCancel}
        />
      )}
    </div>
  );
}
