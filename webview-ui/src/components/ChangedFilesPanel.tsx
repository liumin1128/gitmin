/**
 * 变更文件列表面板：展示累积 diff 的文件、点击打开详细 diff
 */
import type { DiffRange, FileChange, FileStatus } from '../../../shared/domain';

interface Props {
  range: DiffRange | null;
  files: FileChange[];
  loading: boolean;
  onOpenDiff: (filePath: string) => void;
}

const STATUS_LABEL: Record<FileStatus, string> = {
  A: 'A',
  M: 'M',
  D: 'D',
  R: 'R',
  C: 'C',
  U: 'U',
  '?': '?',
};

export function ChangedFilesPanel({ range, files, loading, onOpenDiff }: Props) {
  if (loading) {
    return <div className="empty-hint">加载 diff 中...</div>;
  }
  if (!range) {
    return <div className="empty-hint">从左侧选择一个或多个 commit 查看累积变更</div>;
  }
  if (files.length === 0) {
    return <div className="empty-hint">无文件变更</div>;
  }
  return (
    <div className="files-panel">
      <div className="files-list">
        {files.map((f) => (
          <div
            key={f.path}
            className={`file-item status-${f.status}`}
            onClick={() => onOpenDiff(f.path)}
            title={f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
          >
            <span className="file-status">{STATUS_LABEL[f.status]}</span>
            <span className="file-path">{f.path}</span>
            {!f.binary && (
              <span className="file-stat">
                <span className="stat-add">+{f.insertions}</span>
                <span className="stat-del">-{f.deletions}</span>
              </span>
            )}
            {f.binary && <span className="file-stat binary">binary</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
