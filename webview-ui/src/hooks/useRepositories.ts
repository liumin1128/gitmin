import { useCallback, useState } from 'react';
import type { RepositorySummary } from '../../../shared/repositories';
import { postMessage, useIpcListener } from './useIpc';

export function useRepositories() {
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [selectedRootPath, setSelectedRootPath] = useState<string | null>(null);
  const [pendingRootPath, setPendingRootPath] = useState<string | null>(null);

  useIpcListener('repositories/loaded', ({ snapshot }) => {
    setRepositories(snapshot.repositories);
    setSelectedRootPath(snapshot.selectedRootPath);
    setPendingRootPath((pending) => {
      if (!pending || snapshot.selectedRootPath === pending) return null;
      return snapshot.repositories.some((repository) => repository.rootPath === pending)
        ? pending
        : null;
    });
  });
  useIpcListener('repositories/error', () => {
    setPendingRootPath(null);
  });

  const select = useCallback((rootPath: string) => {
    setPendingRootPath(rootPath);
    postMessage({ type: 'repositories/select', rootPath });
  }, []);

  return {
    repositories,
    selectedRootPath,
    pendingRootPath,
    select,
  };
}
