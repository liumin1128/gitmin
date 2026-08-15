/**
 * Changed files panel: displays cumulative diff file list, click to open detailed diff
 */
import { useEffect, useRef } from 'react';
import type { DiffRange, FileChange } from '../../../shared/domain';
import { t } from '../../../shared/i18n';
import { FileChangeRow } from './FileChangeRow';

interface Props {
  range: DiffRange | null;
  files: FileChange[];
  activeFilePath: string | null;
  loading: boolean;
  onOpenDiff: (filePath: string) => void;
}

export function ChangedFilesPanel({ range, files, activeFilePath, loading, onOpenDiff }: Props) {
  if (loading) {
    return <div className="empty-hint">{t('files.loading')}</div>;
  }
  if (!range) {
    return <div className="empty-hint">{t('files.select')}</div>;
  }
  if (files.length === 0) {
    return <div className="empty-hint">{t('files.none')}</div>;
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
    <FileChangeRow
      rowRef={itemRef}
      path={file.path}
      oldPath={file.oldPath}
      status={file.status}
      active={active}
      onClick={() => onOpenDiff(file.path)}
      trailing={file.binary ? (
        <span className="file-stat binary">{t('files.binary')}</span>
      ) : (
        <span className="file-stat">
          <span className="stat-add">+{file.insertions}</span>
          <span className="stat-del">-{file.deletions}</span>
        </span>
      )}
    />
  );
}
