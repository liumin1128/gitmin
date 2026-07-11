/**
 * 变更文件列表面板：展示累积 diff 的文件、点击打开详细 diff
 */
import { useEffect, useRef } from 'react';
import type { DiffRange, FileChange, FileStatus } from '../../../shared/domain';

interface Props {
  range: DiffRange | null;
  files: FileChange[];
  activeFilePath: string | null;
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

export function ChangedFilesPanel({ range, files, activeFilePath, loading, onOpenDiff }: Props) {
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
        {files.map((file) => (
          <ChangedFileItem
            key={file.path}
            file={file}
            active={file.path === activeFilePath}
            onOpenDiff={onOpenDiff}
          />
        ))}
      </div>
    </div>
  );
}

interface ItemProps {
  file: FileChange;
  active: boolean;
  onOpenDiff: (filePath: string) => void;
}

function ChangedFileItem({ file, active, onOpenDiff }: ItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) itemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div
      ref={itemRef}
      className={`file-item status-${file.status}${active ? ' is-active' : ''}`}
      aria-current={active ? 'true' : undefined}
      onClick={() => onOpenDiff(file.path)}
      title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
    >
      <span className="file-status">{STATUS_LABEL[file.status]}</span>
      <span className="file-path">{file.path}</span>
      {!file.binary && (
        <span className="file-stat">
          <span className="stat-add">+{file.insertions}</span>
          <span className="stat-del">-{file.deletions}</span>
        </span>
      )}
      {file.binary && <span className="file-stat binary">binary</span>}
    </div>
  );
}
