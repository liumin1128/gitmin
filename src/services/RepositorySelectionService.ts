import type { RepositorySnapshot, RepositorySummary } from '../../shared/repositories';
import {
  getRepositoryName,
  isRepositoryInWorkspace,
  resolveSelectedRepository,
} from '../../shared/repositories';
import type { GitApi, GitRepository } from './RepoLocator';
import { t } from '../../shared/i18n';

const SELECTED_REPOSITORY_STATE_KEY = 'gitmin.selectedRepository';

interface Disposable {
  dispose(): void;
}

interface WorkspaceState {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

export interface RepositorySelectionChange extends RepositorySnapshot {
  selectionChanged: boolean;
}

export type GitApiLoader = () => Promise<GitApi | null>;
export type WorkspaceRootPathsProvider = () => readonly string[] | undefined;
type RepositoryListener = (change: RepositorySelectionChange) => void;

export class RepositorySelectionService implements Disposable {
  private readonly workspaceState: WorkspaceState;
  private readonly loadGitApi: GitApiLoader;
  private api: GitApi | null = null;
  private initializePromise: Promise<void> | null = null;
  private selectedRootPath: string | null = null;
  private snapshotSignature = '';
  private selectionQueue: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<RepositoryListener>();
  private readonly apiDisposables: Disposable[] = [];
  private readonly repositoryDisposables = new Map<GitRepository, Disposable>();

  constructor(
    workspaceState: WorkspaceState,
    loadGitApi: GitApiLoader,
    private readonly getWorkspaceRootPaths: WorkspaceRootPathsProvider = () => undefined,
  ) {
    this.workspaceState = workspaceState;
    this.loadGitApi = loadGitApi;
  }

  initialize(): Promise<void> {
    if (!this.initializePromise) this.initializePromise = this.doInitialize();
    return this.initializePromise;
  }

  async refresh(): Promise<void> {
    await this.initialize();
    await this.reconcileRepositories(false);
  }

  getSnapshot(): RepositorySnapshot {
    return {
      repositories: this.getRepositories(),
      selectedRootPath: this.selectedRootPath,
    };
  }

  onDidChange(listener: RepositoryListener): Disposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  select(rootPath: string): Promise<boolean> {
    const result = this.selectionQueue.then(() => this.selectNow(rootPath));
    this.selectionQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private async selectNow(rootPath: string): Promise<boolean> {
    await this.initialize();
    if (!this.getRepositories().some((repository) => repository.rootPath === rootPath)) {
      throw new Error(t('repository.unavailable'));
    }
    if (this.selectedRootPath === rootPath) return false;

    this.selectedRootPath = rootPath;
    this.emitIfChanged(true);
    await this.persistSelection();
    return true;
  }

  dispose(): void {
    this.apiDisposables.forEach((disposable) => disposable.dispose());
    this.repositoryDisposables.forEach((disposable) => disposable.dispose());
    this.apiDisposables.length = 0;
    this.repositoryDisposables.clear();
    this.listeners.clear();
  }

  private async doInitialize(): Promise<void> {
    this.api = await this.loadGitApi();
    if (!this.api) {
      this.emitIfChanged(false);
      return;
    }

    this.apiDisposables.push(
      this.api.onDidOpenRepository(() => void this.reconcileRepositories(false))
    );
    if (this.api.onDidCloseRepository) {
      this.apiDisposables.push(
        this.api.onDidCloseRepository(() => void this.reconcileRepositories(false))
      );
    }
    await this.reconcileRepositories(true);
  }

  private async reconcileRepositories(restorePersistedSelection: boolean): Promise<void> {
    this.syncRepositoryListeners();
    const persisted = restorePersistedSelection
      ? this.workspaceState.get<unknown>(SELECTED_REPOSITORY_STATE_KEY)
      : null;
    const previous = this.selectedRootPath;
    this.selectedRootPath = resolveSelectedRepository(
      this.getRepositories(),
      previous,
      typeof persisted === 'string' ? persisted : null
    );
    const selectionChanged = previous !== this.selectedRootPath;
    this.emitIfChanged(selectionChanged);
    if (selectionChanged) await this.persistSelection();
  }

  private syncRepositoryListeners(): void {
    if (!this.api) return;
    const current = new Set(this.getWorkspaceRepositories());
    this.repositoryDisposables.forEach((disposable, repository) => {
      if (current.has(repository)) return;
      disposable.dispose();
      this.repositoryDisposables.delete(repository);
    });
    current.forEach((repository) => {
      if (this.repositoryDisposables.has(repository)) return;
      this.repositoryDisposables.set(
        repository,
        repository.state.onDidChange(() => this.emitIfChanged(false))
      );
    });
  }

  private getRepositories(): RepositorySummary[] {
    return this.getWorkspaceRepositories().map((repository) => ({
      rootPath: repository.rootUri.fsPath,
      name: getRepositoryName(repository.rootUri.fsPath),
      currentBranch: repository.state.HEAD?.name ?? t('repository.detached'),
    }));
  }

  private getWorkspaceRepositories(): GitRepository[] {
    const workspaceRootPaths = this.getWorkspaceRootPaths();
    if (!workspaceRootPaths) return this.api?.repositories ?? [];
    return (this.api?.repositories ?? []).filter((repository) =>
      isRepositoryInWorkspace(repository.rootUri.fsPath, workspaceRootPaths),
    );
  }

  private async persistSelection(): Promise<void> {
    try {
      await this.workspaceState.update(
        SELECTED_REPOSITORY_STATE_KEY,
        this.selectedRootPath ?? undefined
      );
    } catch (error) {
      console.error('[gitmin] persist selected repository error:', error);
    }
  }

  private emitIfChanged(selectionChanged: boolean): void {
    const snapshot = this.getSnapshot();
    const signature = JSON.stringify(snapshot);
    if (!selectionChanged && signature === this.snapshotSignature) return;
    this.snapshotSignature = signature;
    const change = { ...snapshot, selectionChanged };
    this.listeners.forEach((listener) => listener(change));
  }
}
