/**
 * 顶部工具栏：仓库信息 + 刷新按钮
 * MVP 阶段功能极简，Phase 3 再加分支切换、搜索
 */
import type { RepoInfo } from '../../../shared/domain';

interface Props {
  repo: RepoInfo | null;
  selectedCount: number;
  onRefresh: () => void;
}

export function Toolbar({ repo, selectedCount, onRefresh }: Props) {
  return (
    <div className="toolbar">
      <div className="toolbar-repo">
        {repo ? (
          <>
            <span className="repo-branch">⎇ {repo.currentBranch}</span>
            <span className="repo-path" title={repo.rootPath}>
              {repo.rootPath.split(/[/\\]/).pop()}
            </span>
          </>
        ) : (
          <span className="repo-empty">未加载仓库</span>
        )}
      </div>
      <div className="toolbar-actions">
        {selectedCount > 0 && <span className="selected-count">已选 {selectedCount}</span>}
        <button className="btn" onClick={onRefresh} title="刷新 commit 列表">
          刷新
        </button>
      </div>
    </div>
  );
}
