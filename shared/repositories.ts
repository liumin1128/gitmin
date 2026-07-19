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

/**
 * Returns whether a repository and workspace folder describe the same project
 * tree. A workspace may open either the repository itself, one of its nested
 * folders, or a folder that contains multiple repositories.
 */
export function isRepositoryInWorkspace(
  repositoryRootPath: string,
  workspaceRootPaths: readonly string[],
): boolean {
  const repositoryPath = normalizeRootPath(repositoryRootPath);
  if (!repositoryPath) return false;

  return workspaceRootPaths.some((workspaceRootPath) => {
    const workspacePath = normalizeRootPath(workspaceRootPath);
    return (
      isPathEqualOrDescendant(repositoryPath, workspacePath) ||
      isPathEqualOrDescendant(workspacePath, repositoryPath)
    );
  });
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

function normalizeRootPath(rootPath: string): string {
  const normalized = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!normalized) return rootPath === '/' ? '/' : '';
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}

function isPathEqualOrDescendant(path: string, parentPath: string): boolean {
  if (!parentPath) return false;
  if (parentPath === '/') return path.startsWith('/');
  return path === parentPath || path.startsWith(parentPath + '/');
}
