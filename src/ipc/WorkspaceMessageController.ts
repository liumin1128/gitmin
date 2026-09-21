import * as vscode from 'vscode';
import type {
  Commit,
  DetailSelection,
  DiffRange,
  FileChange,
  StashEntry,
  WorkingTreeGroup,
  WorkingTreeSnapshot,
} from '../../shared/domain';
import type {
  ExtensionMessage,
  GitWorkspaceOperation,
  RefreshTarget,
  WebviewMessage,
} from '../../shared/messages';
import { getCommitMessageLanguage } from '../configuration';
import { FileDiffNavigator } from '../services/FileDiffNavigator';
import { CommitMessageGenerator } from '../services/CommitMessageGenerator';
import { GitService } from '../services/GitService';
import { getRepository } from '../services/RepoLocator';
import { StashService } from '../services/StashService';
import { WorkingTreeDiffNavigator } from '../services/WorkingTreeDiffNavigator';
import { WorkingTreeService } from '../services/WorkingTreeService';
import { computeDiffRange } from '../utils/diffRange';
import { t } from '../../shared/i18n';

type PostMessage = (message: ExtensionMessage) => void;
type SelectionDiffCache = { range: DiffRange; files: FileChange[] } | null;
type SetDiffCache = (cache: SelectionDiffCache) => void;
type SelectionDetailsTarget = 'files' | 'details' | 'all';

export class WorkspaceMessageController implements vscode.Disposable {
  private readonly workingTree: WorkingTreeService;
  private readonly stashes: StashService;
  private readonly workingTreeDiffNavigator: WorkingTreeDiffNavigator;
  private workingTreeCache: WorkingTreeSnapshot = {
    conflicts: [],
    staged: [],
    changes: [],
  };
  private stashCache: StashEntry[] = [];
  private latestWorkingTreeRequestId = 0;
  private latestStashRequestId = 0;
  private latestSelectionRequestId = 0;
  private selectionAbortController: AbortController | null = null;
  private workingTreeReadGeneration = 0;
  private repositoryChangeTimer: NodeJS.Timeout | null = null;
  private disposed = false;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly rootPath: string,
    private readonly git: GitService,
    private readonly commitMessageGenerator: CommitMessageGenerator,
    private readonly post: PostMessage,
    private readonly fileDiffNavigator: FileDiffNavigator,
    private readonly setDiffCache: SetDiffCache
  ) {
    this.workingTree = new WorkingTreeService(rootPath);
    this.stashes = new StashService(rootPath, git);
    this.workingTreeDiffNavigator = new WorkingTreeDiffNavigator(rootPath);
  }

  async initialize(): Promise<void> {
    const repository = await getRepository(this.rootPath);
    if (!repository) return;
    this.disposables.push(
      repository.state.onDidChange(() => this.scheduleWorkingTreeRefresh())
    );
  }

  dispose(): void {
    this.disposed = true;
    this.selectionAbortController?.abort();
    this.selectionAbortController = null;
    if (this.repositoryChangeTimer) clearTimeout(this.repositoryChangeTimer);
    this.workingTreeDiffNavigator.dispose();
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  async loadWorkingTree(requestId: number): Promise<void> {
    if (requestId < this.latestWorkingTreeRequestId) return;
    this.latestWorkingTreeRequestId = requestId;
    const generation = ++this.workingTreeReadGeneration;
    try {
      const snapshot = await this.workingTree.getSnapshot();
      if (!this.isCurrentWorkingTreeRead(generation)) return;
      this.workingTreeCache = snapshot;
      this.post({ type: 'workingTree/loaded', requestId, snapshot });
    } catch (error) {
      if (!this.isCurrentWorkingTreeRead(generation)) return;
      this.post({ type: 'workingTree/error', requestId, error: errorMessage(error) });
    }
  }

  async refreshWorkingTree(): Promise<void> {
    const generation = ++this.workingTreeReadGeneration;
    try {
      const snapshot = await this.workingTree.getSnapshot();
      if (!this.isCurrentWorkingTreeRead(generation)) return;
      this.workingTreeCache = snapshot;
      this.post({ type: 'workingTree/changed', snapshot });
    } catch (error) {
      if (!this.isCurrentWorkingTreeRead(generation)) return;
      console.error('[gitmin] refresh working tree error:', errorMessage(error));
    }
  }

  async openWorkingTreeDiff(group: WorkingTreeGroup, path: string): Promise<void> {
    this.fileDiffNavigator.clear();
    await this.workingTreeDiffNavigator.open(this.workingTreeCache, group, path);
  }

  async loadStashes(requestId: number): Promise<void> {
    this.latestStashRequestId = Math.max(this.latestStashRequestId, requestId);
    try {
      const entries = await this.stashes.listRecent(10);
      if (requestId !== this.latestStashRequestId) return;
      this.stashCache = entries;
      this.post({ type: 'stashes/loaded', requestId, entries });
    } catch (error) {
      if (requestId !== this.latestStashRequestId) return;
      this.post({ type: 'stashes/error', requestId, error: errorMessage(error) });
    }
  }

  async handleWorkingTreeAction(
    message: Extract<WebviewMessage, { type: 'workingTree/action' }>
  ): Promise<void> {
    try {
      const paths = this.validateWorkingTreePaths(message.group, message.paths);
      if (message.action === 'discard') {
        const discardLabel = t('common.discard');
        const answer = await vscode.window.showWarningMessage(
          t('confirm.discardChanges', { count: paths.length }),
          { modal: true },
          discardLabel
        );
        if (answer !== discardLabel) {
          this.postResult(message.requestId, message.action, false, [], 'Cancelled');
          return;
        }
      }

      if (message.action === 'stage') await this.workingTree.stage(paths);
      else if (message.action === 'unstage') await this.workingTree.unstage(paths);
      else await this.workingTree.discard(message.group, paths);
      this.postResult(message.requestId, message.action, true, ['changes']);
    } catch (error) {
      this.postResult(
        message.requestId,
        message.action,
        false,
        ['changes'],
        errorMessage(error)
      );
    }
  }

  async handleCommit(requestId: number, message: string): Promise<void> {
    try {
      await this.workingTree.commit(message);
      this.postResult(requestId, 'commit', true, ['changes', 'commits']);
    } catch (error) {
      this.postResult(requestId, 'commit', false, ['changes'], errorMessage(error));
    }
  }

  async handleGenerateCommitMessage(requestId: number): Promise<void> {
    try {
      const diff = await this.workingTree.getStagedDiff();
      const generated = await this.commitMessageGenerator.generate(
        diff,
        getCommitMessageLanguage()
      );
      if (!generated) {
        this.post({
          type: 'workingTree/commitMessageResult',
          requestId,
          ok: false,
          cancelled: true,
        });
        return;
      }
      this.post({
        type: 'workingTree/commitMessageResult',
        requestId,
        ok: true,
        message: generated.message,
        model: generated.model,
      });
    } catch (error) {
      this.post({
        type: 'workingTree/commitMessageResult',
        requestId,
        ok: false,
        error: errorMessage(error),
      });
    }
  }

  async handleCreateStash(requestId: number, message: string): Promise<void> {
    try {
      const output = (await this.workingTree.createStash(message)).trim();
      this.postResult(
        requestId,
        'stash',
        true,
        ['changes', 'stashes'],
        output || undefined
      );
    } catch (error) {
      this.postResult(
        requestId,
        'stash',
        false,
        ['changes', 'stashes'],
        errorMessage(error)
      );
    }
  }

  async handleStashAction(
    message: Extract<WebviewMessage, { type: 'stashes/action' }>
  ): Promise<void> {
    const operation: GitWorkspaceOperation =
      message.action === 'apply' ? 'apply-stash' : 'delete-stash';
    try {
      const entry = this.findCachedStash(message.selector, message.hash);
      if (message.action === 'delete') {
        const deleteLabel = t('common.delete');
        const answer = await vscode.window.showWarningMessage(
          t('confirm.deleteStash', { selector: entry.selector }),
          { modal: true },
          deleteLabel
        );
        if (answer !== deleteLabel) {
          this.postResult(message.requestId, operation, false, [], 'Cancelled');
          return;
        }
        await this.stashes.deleteVerified(entry);
        this.postResult(message.requestId, operation, true, ['stashes']);
        return;
      }

      await this.stashes.apply(entry.hash);
      this.postResult(message.requestId, operation, true, ['changes']);
    } catch (error) {
      this.postResult(
        message.requestId,
        operation,
        false,
        message.action === 'apply' ? ['changes'] : ['stashes'],
        errorMessage(error)
      );
    }
  }

  async loadSelectionDetails(
    requestId: number,
    selection: DetailSelection,
    commits: Commit[]
  ): Promise<void> {
    if (requestId <= this.latestSelectionRequestId) return;
    this.latestSelectionRequestId = requestId;
    this.selectionAbortController?.abort();
    const abortController = new AbortController();
    this.selectionAbortController = abortController;
    this.clearSelectionDiff();

    try {
      if (selection.kind === 'commits') {
        const commitRange = computeDiffRange(selection.hashes, commits);
        if (!commitRange) throw new Error(t('error.selectedCommitsUnavailable'));
        await Promise.all([
          this.loadSelectionFiles(
            requestId,
            selection,
            commitRange,
            abortController
          ),
          this.loadSelectionCommitDetails(
            requestId,
            selection,
            selection.hashes,
            abortController
          ),
        ]);
      } else {
        const entry = this.findCachedStash(selection.selector, selection.hash);
        const stashDetails = await this.stashes.getDetails(
          entry,
          abortController.signal
        );
        if (!this.isCurrentSelectionRequest(requestId, abortController)) return;
        this.publishSelectionFiles(
          requestId,
          selection,
          stashDetails.range,
          stashDetails.files
        );
        this.post({
          type: 'selectionDetails/detailsLoaded',
          requestId,
          selection,
          details: stashDetails.details,
        });
      }
    } catch (error) {
      this.publishSelectionError(
        requestId,
        selection,
        'all',
        error,
        abortController
      );
    } finally {
      if (this.selectionAbortController === abortController) {
        this.selectionAbortController = null;
      }
    }
  }

  clearSelectionDetails(requestId: number): void {
    if (requestId <= this.latestSelectionRequestId) return;
    this.latestSelectionRequestId = requestId;
    this.selectionAbortController?.abort();
    this.selectionAbortController = null;
    this.clearSelectionDiff();
  }

  private async loadSelectionFiles(
    requestId: number,
    selection: DetailSelection,
    range: DiffRange,
    abortController: AbortController
  ): Promise<void> {
    try {
      const files = await this.git.getDiffSummary(
        range.base,
        range.head,
        abortController.signal
      );
      if (!this.isCurrentSelectionRequest(requestId, abortController)) return;
      this.publishSelectionFiles(requestId, selection, range, files);
    } catch (error) {
      this.publishSelectionError(
        requestId,
        selection,
        'files',
        error,
        abortController
      );
    }
  }

  private async loadSelectionCommitDetails(
    requestId: number,
    selection: DetailSelection,
    hashes: string[],
    abortController: AbortController
  ): Promise<void> {
    try {
      const details = await this.git.getCommitDetails(
        hashes,
        abortController.signal
      );
      if (!this.isCurrentSelectionRequest(requestId, abortController)) return;
      this.post({
        type: 'selectionDetails/detailsLoaded',
        requestId,
        selection,
        details,
      });
    } catch (error) {
      this.publishSelectionError(
        requestId,
        selection,
        'details',
        error,
        abortController
      );
    }
  }

  private publishSelectionFiles(
    requestId: number,
    selection: DetailSelection,
    range: DiffRange,
    files: FileChange[]
  ): void {
    this.setDiffCache({ range, files });
    this.post({
      type: 'selectionDetails/filesLoaded',
      requestId,
      selection,
      range,
      files,
    });
  }

  private publishSelectionError(
    requestId: number,
    selection: DetailSelection,
    target: SelectionDetailsTarget,
    error: unknown,
    abortController: AbortController
  ): void {
    if (!this.isCurrentSelectionRequest(requestId, abortController)) return;
    this.post({
      type: 'selectionDetails/error',
      requestId,
      selection,
      target,
      error: errorMessage(error),
    });
  }

  private isCurrentSelectionRequest(
    requestId: number,
    abortController: AbortController
  ): boolean {
    return (
      !this.disposed &&
      !abortController.signal.aborted &&
      requestId === this.latestSelectionRequestId &&
      abortController === this.selectionAbortController
    );
  }

  private clearSelectionDiff(): void {
    this.fileDiffNavigator.clear();
    this.setDiffCache(null);
    this.post({ type: 'diff/activeFile', filePath: null });
  }

  private scheduleWorkingTreeRefresh(): void {
    if (this.repositoryChangeTimer) clearTimeout(this.repositoryChangeTimer);
    this.repositoryChangeTimer = setTimeout(() => {
      this.repositoryChangeTimer = null;
      void this.refreshWorkingTree();
    }, 100);
  }

  private isCurrentWorkingTreeRead(generation: number): boolean {
    return !this.disposed && generation === this.workingTreeReadGeneration;
  }

  private validateWorkingTreePaths(group: WorkingTreeGroup, paths: string[]): string[] {
    const available = new Set(this.workingTreeCache[group].map((item) => item.path));
    const unique = [...new Set(paths)];
    if (unique.length === 0 || unique.some((path) => !available.has(path))) {
      throw new Error(t('error.selectedChangesStale'));
    }
    return unique;
  }

  private findCachedStash(selector: string, hash: string): StashEntry {
    const entry = this.stashCache.find(
      (candidate) => candidate.selector === selector && candidate.hash === hash
    );
    if (!entry) throw new Error(t('error.selectedStashStale'));
    return entry;
  }

  private postResult(
    requestId: number,
    operation: GitWorkspaceOperation,
    ok: boolean,
    refresh: RefreshTarget[],
    message?: string
  ): void {
    this.post({
      type: 'workingTree/actionResult',
      requestId,
      operation,
      ok,
      refresh,
      ...(message ? { message } : {}),
    });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
