/**
 * 顶层容器：
 * - 挂载后通知 extension（webview/ready）
 * - 订阅所有 extension 消息，维护 repo/commits/diff 状态
 * - 组合 useMultiSelect，并在选择变化时请求 diff
 * - 将纯数据与回调下发给 UI 组件
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { postMessage, useIpcListener } from './hooks/useIpc';
import { useMultiSelect } from './hooks/useMultiSelect';
import { Toolbar } from './components/Toolbar';
import { CommitList } from './components/CommitList';
import { ChangedFilesPanel } from './components/ChangedFilesPanel';
import type { Commit, DiffRange, FileChange, RepoInfo } from '../../shared/domain';

export function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DiffRange | null>(null);
  const [files, setFiles] = useState<FileChange[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);

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
  useIpcListener('diff/loaded', (m) => {
    setRange(m.range);
    setFiles(m.files);
    setDiffLoading(false);
  });
  useIpcListener('diff/error', (m) => {
    setError(m.error);
    setDiffLoading(false);
  });

  // === 生命周期：挂载即通知 ===
  useEffect(() => {
    postMessage({ type: 'webview/ready' });
  }, []);

  // === 多选 ===
  const commitHashes = useMemo(() => commits.map((c) => c.hash), [commits]);
  const { selected, isSelected, onItemClick, clear } = useMultiSelect(commitHashes);

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
    // 依赖 selectionKey 而非 selected 引用，避免同集合触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const handleRefresh = useCallback(() => {
    clear();
    postMessage({ type: 'commits/refresh', limit: 100 });
  }, [clear]);

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
      {error && <div className="error-bar">{error}</div>}
      <div className="split">
        <div className="split-left">
          <CommitList
            commits={commits}
            isSelected={isSelected}
            onItemClick={onItemClick}
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
    </div>
  );
}
