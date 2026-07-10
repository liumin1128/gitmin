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
import { Toolbar } from './components/Toolbar';
import { FilterBar } from './components/FilterBar';
import { CommitList } from './components/CommitList';
import { ChangedFilesPanel } from './components/ChangedFilesPanel';
import { CommitContextMenu } from './components/CommitContextMenu';
import type {
  Commit,
  CommitFilters,
  DiffRange,
  FileChange,
  FilterOptions,
  RepoInfo,
} from '../../shared/domain';
import type { GitAction } from '../../shared/actions';

export function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DiffRange | null>(null);
  const [files, setFiles] = useState<FileChange[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<CommitFilters>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    branches: [],
    authors: [],
  });

  // === 消息订阅 ===
  useIpcListener('repo/info', (m) => {
    setRepo(m.info);
    setRepoError(null);
  });
  useIpcListener('repo/none', (m) => {
    setRepo(null);
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
    setDiffLoading(false);
  });
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
      <Toolbar repo={repo} selectedCount={selected.size} onRefresh={handleRefresh} />
      <FilterBar filters={filters} options={filterOptions} onChange={setFilters} />
      {error && <div className="error-bar">{error}</div>}
      {busy && <div className="busy-bar">执行中...</div>}
      <div className="split">
        <div className="split-left">
          <CommitList
            commits={commits}
            isSelected={isSelected}
            onItemClick={onItemClick}
            onItemContextMenu={handleContextMenu}
          />
        </div>
        <div className="split-right">
          <ChangedFilesPanel
            range={range}
            files={files}
            loading={diffLoading}
            onOpenDiff={handleOpenDiff}
          />
        </div>
      </div>
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
