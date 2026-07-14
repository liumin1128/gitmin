import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommitDetails,
  DetailSelection,
  DiffRange,
  FileChange,
} from '../../../shared/domain';
import { postMessage, useIpcListener } from './useIpc';

export function useSelectionDetails(selection: DetailSelection | null) {
  const [range, setRange] = useState<DiffRange | null>(null);
  const [files, setFiles] = useState<FileChange[]>([]);
  const [details, setDetails] = useState<CommitDetails[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const selectionKey = useMemo(() => {
    if (!selection) return '';
    return selection.kind === 'commits'
      ? `commits:${selection.hashes.join('|')}`
      : `stash:${selection.hash}`;
  }, [selection]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setActiveFilePath(null);
    setError(null);
    if (!selection) {
      setRange(null);
      setFiles([]);
      setDetails([]);
      setLoading(false);
      postMessage({ type: 'selectionDetails/clear' });
      return;
    }
    setLoading(true);
    postMessage({ type: 'selectionDetails/request', requestId, selection });
    // The normalized selection key is the request identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  useIpcListener('selectionDetails/loaded', (response) => {
    if (response.requestId !== requestIdRef.current) return;
    setRange(response.range);
    setFiles(response.files);
    setDetails(response.details);
    setActiveFilePath(null);
    setLoading(false);
    setError(null);
  });
  useIpcListener('selectionDetails/error', (response) => {
    if (response.requestId !== requestIdRef.current) return;
    setRange(null);
    setFiles([]);
    setDetails([]);
    setActiveFilePath(null);
    setLoading(false);
    setError(response.error);
  });
  useIpcListener('diff/activeFile', (response) => setActiveFilePath(response.filePath));

  const openDiff = useCallback(
    (filePath: string) => {
      if (!range) return;
      postMessage({ type: 'file/openDiff', range, filePath });
    },
    [range]
  );

  return {
    range,
    files,
    details,
    activeFilePath,
    loading,
    error,
    openDiff,
  };
}
