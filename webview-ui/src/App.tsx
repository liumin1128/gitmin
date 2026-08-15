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
import { useSelectionDetails } from './hooks/useSelectionDetails';
import { useStashes } from './hooks/useStashes';
import { useWorkingTree } from './hooks/useWorkingTree';
import { useRepositories } from './hooks/useRepositories';
import { FilterBar } from './components/FilterBar';
import { CommitList, DEFAULT_COLUMNS, type ColumnFlags } from './components/CommitList';
import { ColumnsMenu } from './components/ColumnsMenu';
import { ChangedFilesPanel } from './components/ChangedFilesPanel';
import { CommitDetailsPanel } from './components/CommitDetailsPanel';
import { CommitContextMenu } from './components/CommitContextMenu';
import { SquashModal } from './components/SquashModal';
import { WorkbenchPanelStack } from './components/WorkbenchPanelStack';
import { ChangesPanel } from './components/ChangesPanel';
import { StashList } from './components/StashList';
import { WorkbenchToolbar } from './components/WorkbenchToolbar';
import { RepositoryList } from './components/RepositoryList';
import {
  WORKBENCH_VIEW_IDS,
  type WorkbenchViewVisibility,
} from '../../shared/workbenchViews';
import { shouldPreserveUnresolvedParents } from './utils/commitGraph';
import { commitSelection, stashSelection } from './utils/detailSelection';
import { COMMIT_PAGE_SIZE, type CommitPage } from '../../shared/commitPagination';
import type {
  Commit,
  CommitFilters,
  FilterOptions,
  StashEntry,
} from '../../shared/domain';
import type { WebviewMessage } from '../../shared/messages';
import type { GitAction } from '../../shared/actions';
import { t } from '../../shared/i18n';
import { workingTreeChangeCount } from '../../shared/workingTree';

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
  const [busy, setBusy] = useState(false);
  const [squashHashes, setSquashHashes] = useState<string[] | null>(null);
  const [selectedStash, setSelectedStash] = useState<StashEntry | null>(null);
  const repositories = useRepositories();
  const { filters, setFilters } = usePersistedFilters();
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    branches: [],
    authors: [],
  });
  const [columns, setColumns] = useState<ColumnFlags>(DEFAULT_COLUMNS);
  const {
    layout,
    setPanelHeight,
    setVisible,
    toggleVisible,
    setCollapsed,
  } = useWorkbenchLayout();
  const showWorkbenchToolbar = document.body.dataset.gitminHost === 'panel';
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
  const refreshChangesRef = useRef<() => void>(() => undefined);
  const refreshStashesRef = useRef<() => void>(() => undefined);
  const clearStashSelectionRef = useRef<() => void>(() => undefined);
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
  useIpcListener('workbenchViews/toggle', (m) => {
    toggleVisible(m.id);
  });

  useEffect(() => {
    if (showWorkbenchToolbar) return;
    const visibility = Object.fromEntries(
      WORKBENCH_VIEW_IDS.map((id) => [id, layout.views[id].visible])
    ) as WorkbenchViewVisibility;
    postMessage({ type: 'workbenchViews/visibility', visibility });
  }, [layout.views, showWorkbenchToolbar]);
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
  const {
    selected,
    isSelected,
    onItemClick: selectCommit,
    selectOnly,
    clear,
  } = useMultiSelect(commitHashes);

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

  const refreshCommitsFromWorkspace = useCallback(() => {
    resetCommits(filtersRef.current);
  }, [resetCommits]);
  const requestChangesRefresh = useCallback(() => refreshChangesRef.current(), []);
  const requestStashesRefresh = useCallback(() => refreshStashesRef.current(), []);
  const handleStashSelectionChange = useCallback(
    (entry: StashEntry | null) => {
      setSelectedStash(entry);
      if (entry) clear();
    },
    [clear]
  );
  const workingTree = useWorkingTree({
    onRefreshCommits: refreshCommitsFromWorkspace,
    onRefreshStashes: requestStashesRefresh,
  });
  refreshChangesRef.current = workingTree.refresh;
  const stashes = useStashes({
    onSelectionChange: handleStashSelectionChange,
    onRefreshChanges: requestChangesRefresh,
  });
  refreshStashesRef.current = stashes.refresh;
  clearStashSelectionRef.current = stashes.clearSelection;

  const activeSelection = useMemo(
    () => stashSelection(selectedStash) ?? commitSelection([...selected]),
    [selectedStash, selected]
  );
  const selectionDetails = useSelectionDetails(activeSelection);
  const handleCommitClick = useCallback(
    (hash: string, event: React.MouseEvent) => {
      clearStashSelectionRef.current();
      selectCommit(hash, event);
    },
    [selectCommit]
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
      setError(m.message ?? t('common.operationFailed'));
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

  // === Context menu ===
  const menu = useContextMenu();
  const handleContextMenu = useCallback(
    (hash: string, event: React.MouseEvent) => {
      clearStashSelectionRef.current();
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

  useIpcListener('repositories/selectionChanged', ({ rootPath }) => {
    const requestId = startCommitPageSession(pagination);
    clear();
    clearStashSelectionRef.current();
    menu.close();
    setCommits([]);
    setSelectedStash(null);
    setHasMore(true);
    setLoadingMore(Boolean(rootPath));
    setCommitPageError(null);
    setError(null);
    setBusy(false);
    setSquashHashes(null);
    setFilterOptions({ branches: [], authors: [] });
    failedCommitOffsetRef.current = null;
    initialCommitLoadSettledRef.current = false;
    queuedCommitResetFiltersRef.current = null;
    setRepoError(rootPath ? null : t('repository.none'));
    if (rootPath) {
      postMessage({ type: 'repositories/load', requestId, limit: COMMIT_PAGE_SIZE });
    } else {
      loadingMoreRef.current = false;
      pendingCommitOffsetRef.current = null;
    }
  });

  const handleRefresh = useCallback(() => {
    resetCommits(filters);
    postMessage({ type: 'filters/refresh' });
  }, [filters, resetCommits]);

  return (
    <div className="app">
      {showWorkbenchToolbar && (
        <WorkbenchToolbar
          views={layout.views}
          onVisibleChange={(id, visible) => setVisible(id, visible)}
        />
      )}
      {repoError && (
        <div className="error-bar">{repoError}</div>
      )}
      {!repoError && (commitPageError ?? error) && (
        <div className="error-bar">{commitPageError ?? error}</div>
      )}
      {!repoError && busy && <div className="busy-bar">{t('common.executing')}</div>}
      <WorkbenchPanelStack
        heights={layout.heights}
        onCollapsedChange={setCollapsed}
        onHeightChange={setPanelHeight}
        panels={[
          {
            id: 'repositories',
            title: t('view.repositories'),
            count: repositories.repositories.length,
            visible: layout.views.repositories.visible,
            collapsed: layout.views.repositories.collapsed,
            content: (
              <RepositoryList
                repositories={repositories.repositories}
                selectedRootPath={repositories.selectedRootPath}
                pendingRootPath={repositories.pendingRootPath}
                error={repositories.error}
                onSelect={repositories.select}
              />
            ),
          },
          {
            id: 'changes',
            title: t('view.changes'),
            count: workingTreeChangeCount(workingTree.snapshot),
            visible: layout.views.changes.visible,
            collapsed: layout.views.changes.collapsed,
            content: (
              <ChangesPanel
                snapshot={workingTree.snapshot}
                message={workingTree.message}
                selectedKeys={workingTree.selectedKeys}
                busy={workingTree.busy}
                generating={workingTree.generating}
                error={workingTree.error}
                notice={workingTree.notice}
                commitEnabled={workingTree.commitEnabled}
                generateEnabled={workingTree.generateEnabled}
                stashEnabled={workingTree.stashEnabled}
                onMessageChange={workingTree.setMessage}
                onSelect={workingTree.onSelect}
                onOpenDiff={workingTree.openDiff}
                onAction={workingTree.runAction}
                onCommit={workingTree.commit}
                onGenerateCommitMessage={workingTree.generateCommitMessage}
                onStash={workingTree.stash}
                onRefresh={workingTree.refresh}
              />
            ),
          },
          {
            id: 'commits',
            title: t('view.commits'),
            count: commits.length,
            visible: layout.views.commits.visible,
            collapsed: layout.views.commits.collapsed,
            actions: commitPageError ? (
              <button
                type="button"
                className="toolbar-icon-button"
                title={t('panel.retryCommits')}
                aria-label={t('panel.retryCommits')}
                onClick={retryFailedCommitPageRequest}
              >
                <span className="codicon codicon-refresh" aria-hidden="true" />
              </button>
            ) : undefined,
            content: (
              <div className="commits-panel-content" data-panel-natural-height="children">
                <FilterBar
                  filters={filters}
                  options={filterOptions}
                  onChange={setFilters}
                  onRefresh={handleRefresh}
                  actions={<ColumnsMenu columns={columns} onChange={setColumns} />}
                />
                <div className="commit-list-scroll">
                  <CommitList
                    commits={commits}
                    columns={columns}
                    isSelected={isSelected}
                    onItemClick={handleCommitClick}
                    onItemContextMenu={handleContextMenu}
                    hasMore={hasMore}
                    preserveUnresolvedParents={shouldPreserveUnresolvedParents(hasMore, filters)}
                    loadingMore={loadingMore}
                    automaticLoadEnabled={!commitPageError}
                    onLoadMore={loadMoreCommits}
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'stashes',
            title: t('view.stashes'),
            count: stashes.entries.length,
            visible: layout.views.stashes.visible,
            collapsed: layout.views.stashes.collapsed,
            content: (
              <StashList
                entries={stashes.entries}
                selectedHash={stashes.selected?.hash ?? null}
                busy={stashes.busy}
                error={stashes.error}
                onSelect={stashes.select}
                onRefresh={stashes.refresh}
                onApply={stashes.apply}
                onDelete={stashes.deleteSelected}
              />
            ),
          },
          {
            id: 'files',
            title: t('view.changedFiles'),
            count: selectionDetails.range ? selectionDetails.files.length : undefined,
            visible: layout.views.files.visible,
            collapsed: layout.views.files.collapsed,
            actions:
              selectionDetails.range && !selectionDetails.range.contiguous ? (
                <span
                  className="warn-tag"
                  title={t('panel.nonContiguous')}
                >
                  ⚠
                </span>
              ) : undefined,
            content: (
              <ChangedFilesPanel
                range={selectionDetails.range}
                files={selectionDetails.files}
                activeFilePath={selectionDetails.activeFilePath}
                loading={selectionDetails.loading}
                onOpenDiff={selectionDetails.openDiff}
              />
            ),
          },
          {
            id: 'details',
            title: t('view.commitDetails'),
            count: selectionDetails.details.length,
            visible: layout.views.details.visible,
            collapsed: layout.views.details.collapsed,
            content: (
              <CommitDetailsPanel
                details={selectionDetails.details}
                loading={selectionDetails.loading}
                error={selectionDetails.error}
              />
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
