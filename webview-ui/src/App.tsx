/**
 * 顶层容器：
 * - 挂载后通知 extension（webview/ready）
 * - 订阅所有 extension 消息，维护 repo/commits/diff/action 状态
 * - 组合 useMultiSelect + useContextMenu
 * - 将纯数据与回调下发给 UI 组件
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { postMessage, useIpcListener } from './hooks/useIpc';
import { useMultiSelect } from './hooks/useMultiSelect';
import { useContextMenu } from './hooks/useContextMenu';
import { useWorkbenchLayout } from './hooks/useWorkbenchLayout';
import { FilterBar } from './components/FilterBar';
import { CommitList, DEFAULT_COLUMNS, type ColumnFlags } from './components/CommitList';
import { ChangedFilesPanel } from './components/ChangedFilesPanel';
import { CommitContextMenu } from './components/CommitContextMenu';
import { ResizableSplitView } from './components/ResizableSplitView';
import { ViewSection } from './components/ViewSection';
import { ViewVisibilityMenu } from './components/ViewVisibilityMenu';
import type {
  Commit,
  CommitFilters,
  DiffRange,
  FileChange,
  FilterOptions,
} from '../../shared/domain';
import type { GitAction } from '../../shared/actions';

export function App() {
  const [repoError, setRepoError] = useState<string | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DiffRange | null>(null);
  const [files, setFiles] = useState<FileChange[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<CommitFilters>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    branches: [],
    authors: [],
  });
  const [columns, setColumns] = useState<ColumnFlags>(DEFAULT_COLUMNS);
  const { layout, setRatio, setVisible, setCollapsed } = useWorkbenchLayout();

  // === 消息订阅 ===
  useIpcListener('repo/info', () => {
    setRepoError(null);
  });
  useIpcListener('repo/none', (m) => {
    setRepoError(m.reason);
  });
  useIpcListener('commits/loaded', (m) => {
    setCommits(m.commits);
    setError(null);
  });
  useIpcListener('commits/error', (m) => setError(m.error));
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
  useIpcListener('action/result', (m) => {
    setBusy(false);
    if (!m.ok) setError(m.message ?? '操作失败');
    else setError(null);
  });

  // === 生命周期：挂载即通知 ===
  useEffect(() => {
    postMessage({ type: 'webview/ready' });
  }, []);

  // === 多选 ===
  const commitHashes = useMemo(() => commits.map((c) => c.hash), [commits]);
  const { selected, isSelected, onItemClick, selectOnly, clear } = useMultiSelect(commitHashes);

  // === filter 变化 → 重新拉取 commits（跳过首次挂载，交给 webview/ready）===
  const filtersReadyRef = useRef(false);
  useEffect(() => {
    if (!filtersReadyRef.current) {
      filtersReadyRef.current = true;
      return;
    }
    clear();
    postMessage({ type: 'commits/refresh', limit: 100, filters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // 选中是否连续（Squash 需要）
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

  // === 选择变化 → 请求 diff ===
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

  // === 右键菜单 ===
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
      setBusy(true);
      setError(null);
      postMessage({ type: 'action/execute', action, hashes: [...selected] });
    },
    [selected, menu]
  );

  const handleRefresh = useCallback(() => {
    clear();
    postMessage({ type: 'commits/refresh', limit: 100, filters });
    postMessage({ type: 'filters/refresh' });
  }, [clear, filters]);

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
        columns={columns}
        onColumnsChange={setColumns}
        onRefresh={handleRefresh}
        actions={
          <ViewVisibilityMenu
            commitsVisible={layout.views.commits.visible}
            filesVisible={layout.views.files.visible}
            onCommitsVisibleChange={(visible) => setVisible('commits', visible)}
            onFilesVisibleChange={(visible) => setVisible('files', visible)}
          />
        }
      />
      {error && <div className="error-bar">{error}</div>}
      {busy && <div className="busy-bar">执行中...</div>}
      <ResizableSplitView
        ratio={layout.splitRatio}
        firstVisible={layout.views.commits.visible}
        firstCollapsed={layout.views.commits.collapsed}
        secondVisible={layout.views.files.visible}
        secondCollapsed={layout.views.files.collapsed}
        onRatioChange={setRatio}
        first={
          <ViewSection
            id="commits"
            title="提交"
            count={commits.length}
            visible={layout.views.commits.visible}
            collapsed={layout.views.commits.collapsed}
            onCollapsedChange={(collapsed) => setCollapsed('commits', collapsed)}
          >
            <CommitList
              commits={commits}
              columns={columns}
              isSelected={isSelected}
              onItemClick={onItemClick}
              onItemContextMenu={handleContextMenu}
            />
          </ViewSection>
        }
        second={
          <ViewSection
            id="files"
            title="更改的文件"
            count={range ? files.length : undefined}
            visible={layout.views.files.visible}
            collapsed={layout.views.files.collapsed}
            onCollapsedChange={(collapsed) => setCollapsed('files', collapsed)}
            actions={
              range && !range.contiguous ? (
                <span
                  className="warn-tag"
                  title="选中的 commit 不连续，diff 范围包含未选中的 commit 修改"
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
        }
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
    </div>
  );
}
