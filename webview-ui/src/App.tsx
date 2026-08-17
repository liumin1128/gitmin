/**
 * Top-level container:
 * - Owns cross-panel state (errors, busy, squash modal, context menu)
 * - Domain data lives in dedicated hooks (useCommits/useWorkingTree/useStashes/...)
 * - Passes pure data and callbacks down to UI components
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { postMessage, useIpcListener } from './hooks/useIpc';
import { useMultiSelect } from './hooks/useMultiSelect';
import { useContextMenu } from './hooks/useContextMenu';
import { useWorkbenchLayout } from './hooks/useWorkbenchLayout';
import { usePersistedFilters } from './hooks/usePersistedFilters';
import { usePersistedCommitColumns } from './hooks/usePersistedCommitColumns';
import { useSelectionDetails } from './hooks/useSelectionDetails';
import { useStashes } from './hooks/useStashes';
import { useWorkingTree } from './hooks/useWorkingTree';
import { useRepositories } from './hooks/useRepositories';
import { useCommits } from './hooks/useCommits';
import { FilterBar } from './components/FilterBar';
import { CommitList } from './components/CommitList';
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
import { AppStatusBars } from './components/AppStatusBars';
import { IconButton } from './components/common/IconButton';
import { shouldPreserveUnresolvedParents } from './utils/commitGraph';
import { commitSelection, stashSelection } from './utils/detailSelection';
import type { CommitFilters, FilterOptions, StashEntry } from '../../shared/domain';
import type { GitAction } from '../../shared/actions';
import { t } from '../../shared/i18n';
import { workingTreeChangeCount } from '../../shared/workingTree';

export function App() {
  const [repoError, setRepoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [squashHashes, setSquashHashes] = useState<string[] | null>(null);
  const [selectedStash, setSelectedStash] = useState<StashEntry | null>(null);
  const repositories = useRepositories();
  const { filters, setFilters } = usePersistedFilters();
  const { columns, setColumns } = usePersistedCommitColumns();
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    branches: [],
    authors: [],
  });
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const {
    layout,
    setPanelHeight,
    setVisible,
    setCollapsed,
  } = useWorkbenchLayout();
  const filtersReadyRef = useRef(false);
  const restoringFiltersRef = useRef(false);
  const refreshChangesRef = useRef<() => void>(() => undefined);
  const refreshStashesRef = useRef<() => void>(() => undefined);
  const clearStashSelectionRef = useRef<() => void>(() => undefined);
  const clearCommitSelectionRef = useRef<() => void>(() => undefined);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const clearError = useCallback(() => setError(null), []);

  const {
    commits,
    hasMore,
    loadingMore,
    commitPageError,
    resetCommits,
    loadNextPage: loadMoreCommits,
    retryFailedPage: retryFailedCommitPageRequest,
    handleRepositorySelection,
  } = useCommits({
    filters,
    clearSelectionRef: clearCommitSelectionRef,
    onLoaded: clearError,
  });

  // === Message subscriptions ===
  useIpcListener('repo/info', () => {
    setRepoError(null);
  });
  useIpcListener('repo/none', (m) => {
    setRepoError(m.reason);
  });
  useIpcListener('filters/restored', (m) => {
    restoringFiltersRef.current = true;
    setFilters(m.filters);
  });
  useIpcListener('filters/options', (m) => setFilterOptions(m.options));
  useIpcListener('workbenchViews/menuToggle', () => {
    setViewMenuOpen((open) => !open);
  });

  // === Multi-select ===
  const commitHashes = useMemo(() => commits.map((c) => c.hash), [commits]);
  const {
    selected,
    isSelected,
    onItemClick: selectCommit,
    selectOnly,
    clear,
  } = useMultiSelect(commitHashes);
  clearCommitSelectionRef.current = clear;

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

  // === Filter changes → re-fetch commits (initial load is handled by useCommits) ===
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
    clear();
    clearStashSelectionRef.current();
    menu.close();
    setSelectedStash(null);
    setError(null);
    setBusy(false);
    setSquashHashes(null);
    setFilterOptions({ branches: [], authors: [] });
    setRepoError(rootPath ? null : t('repository.none'));
    handleRepositorySelection(rootPath);
  });

  const handleRefresh = useCallback(() => {
    resetCommits(filters);
    postMessage({ type: 'filters/refresh' });
  }, [filters, resetCommits]);

  return (
    <div className="app">
      <WorkbenchToolbar
        views={layout.views}
        onVisibleChange={(id, visible) => setVisible(id, visible)}
        menuOpen={viewMenuOpen}
        onMenuOpenChange={setViewMenuOpen}
      />
      <AppStatusBars
        repoError={repoError}
        error={commitPageError ?? error}
        busy={busy}
      />
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
              <IconButton
                icon="refresh"
                title={t('panel.retryCommits')}
                onClick={retryFailedCommitPageRequest}
              />
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
