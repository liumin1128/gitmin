export interface RepositorySummary {
  rootPath: string;
  name: string;
  currentBranch: string;
}

export interface RepositorySnapshot {
  repositories: RepositorySummary[];
  selectedRootPath: string | null;
}

export function getRepositoryName(rootPath: string): string {
  const normalized = rootPath.replace(/[\\/]+$/, '');
  return normalized.split(/[\\/]/).pop() || rootPath;
}

export function resolveSelectedRepository(
  repositories: readonly RepositorySummary[],
  currentRootPath: string | null,
  persistedRootPath: string | null
): string | null {
  const available = new Set(repositories.map((repository) => repository.rootPath));
  if (currentRootPath && available.has(currentRootPath)) return currentRootPath;
  if (persistedRootPath && available.has(persistedRootPath)) return persistedRootPath;
  return repositories[0]?.rootPath ?? null;
}
