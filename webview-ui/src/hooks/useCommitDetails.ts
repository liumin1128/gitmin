import { useEffect, useMemo, useState } from 'react';
import type { Commit, CommitDetails } from '../../../shared/domain';
import { postMessage, useIpcListener } from './useIpc';

export function useCommitDetails(commits: Commit[], selected: ReadonlySet<string>) {
  const [details, setDetails] = useState<CommitDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hashes = useMemo(
    () => commits.filter((commit) => selected.has(commit.hash)).map((commit) => commit.hash),
    [commits, selected]
  );
  const selectionKey = hashes.join('|');

  useIpcListener('commitDetails/loaded', (message) => {
    if (message.hashes.join('|') !== selectionKey) return;
    setDetails(message.details);
    setLoading(false);
    setError(null);
  });
  useIpcListener('commitDetails/error', (message) => {
    if (message.hashes.join('|') !== selectionKey) return;
    setDetails([]);
    setLoading(false);
    setError(message.error);
  });

  useEffect(() => {
    if (hashes.length === 0) {
      setDetails([]);
      setLoading(false);
      setError(null);
      return;
    }
    setDetails([]);
    setLoading(true);
    setError(null);
    postMessage({ type: 'commitDetails/request', hashes });
    // hashes are represented by the stable selection key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  return { details, hashes, loading, error };
}
