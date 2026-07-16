import type { RepositorySummary } from '../../../shared/repositories';

interface Props {
  repositories: RepositorySummary[];
  selectedRootPath: string | null;
  pendingRootPath: string | null;
  error: string | null;
  onSelect: (rootPath: string) => void;
}

export function RepositoryList({
  repositories,
  selectedRootPath,
  pendingRootPath,
  error,
  onSelect,
}: Props) {
  return (
    <div className="repository-list">
      {error && <div className="section-error">{error}</div>}
      {repositories.map((repository) => {
        const selected = repository.rootPath === selectedRootPath;
        const pending = pendingRootPath !== null;
        return (
          <button
            key={repository.rootPath}
            type="button"
            className={`repository-item${selected ? ' is-selected' : ''}`}
            title={repository.rootPath}
            aria-pressed={selected}
            disabled={pending}
            onClick={() => {
              if (!selected) onSelect(repository.rootPath);
            }}
          >
            <span className="codicon codicon-repo repository-icon" aria-hidden="true" />
            <span className="repository-name">{repository.name}</span>
            <span className="repository-branch">
              <span className="codicon codicon-git-branch" aria-hidden="true" />
              <span>{repository.currentBranch}</span>
            </span>
            {selected && <span className="codicon codicon-check repository-check" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
