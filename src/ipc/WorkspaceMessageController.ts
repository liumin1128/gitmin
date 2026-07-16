import * as vscode from 'vscode';
import type {
  Commit,
  CommitDetails,
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

type PostMessage = (message: ExtensionMessage) => void;
type SetDiffCache = (range: DiffRange, files: FileChange[]) => void;

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
  private repositoryChangeTimer: NodeJS.Timeout | null = null;
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
      repository.state.onDidChange(() => this.scheduleWorkingTreeChanged())
    );
  }

  dispose(): void {
    if (this.repositoryChangeTimer) clearTimeout(this.repositoryChangeTimer);
    this.workingTreeDiffNavigator.dispose();
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  async loadWorkingTree(requestId: number): Promise<void> {
    this.latestWorkingTreeRequestId = Math.max(this.latestWorkingTreeRequestId, requestId);
    try {
      const snapshot = await this.workingTree.getSnapshot();
      if (requestId !== this.latestWorkingTreeRequestId) return;
      this.workingTreeCache = snapshot;
      this.post({ type: 'workingTree/loaded', requestId, snapshot });
    } catch (error) {
      if (requestId !== this.latestWorkingTreeRequestId) return;
      this.post({ type: 'workingTree/error', requestId, error: errorMessage(error) });
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
        const answer = await vscode.window.showWarningMessage(
          `Discard changes in ${paths.length} selected file(s)? This cannot be undone.`,
          { modal: true },
          'Discard'
        );
        if (answer !== 'Discard') {
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
        const answer = await vscode.window.showWarningMessage(
          `Delete ${entry.selector}? This cannot be undone.`,
          { modal: true },
          'Delete'
        );
        if (answer !== 'Delete') {
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
    this.latestSelectionRequestId = Math.max(this.latestSelectionRequestId, requestId);
    try {
      let range: DiffRange;
      let files: FileChange[];
      let details: CommitDetails[];

      if (selection.kind === 'commits') {
        const commitRange = computeDiffRange(selection.hashes, commits);
        if (!commitRange) throw new Error('Selected commits are unavailable');
        range = commitRange;
        [files, details] = await Promise.all([
          this.git.getDiffSummary(range.base, range.head),
          this.git.getCommitDetails(selection.hashes),
        ]);
      } else {
        const entry = this.findCachedStash(selection.selector, selection.hash);
        const stashDetails = await this.stashes.getDetails(entry);
        range = stashDetails.range;
        files = stashDetails.files;
        details = stashDetails.details;
      }

      if (requestId !== this.latestSelectionRequestId) return;
      this.fileDiffNavigator.clear();
      this.setDiffCache(range, files);
      this.post({ type: 'diff/activeFile', filePath: null });
      this.post({
        type: 'selectionDetails/loaded',
        requestId,
        selection,
        range,
        files,
        details,
      });
    } catch (error) {
      if (requestId !== this.latestSelectionRequestId) return;
      this.post({
        type: 'selectionDetails/error',
        requestId,
        selection,
        error: errorMessage(error),
      });
    }
  }

  private scheduleWorkingTreeChanged(): void {
    if (this.repositoryChangeTimer) clearTimeout(this.repositoryChangeTimer);
    this.repositoryChangeTimer = setTimeout(() => {
      this.repositoryChangeTimer = null;
      this.post({ type: 'workingTree/changed' });
    }, 100);
  }

  private validateWorkingTreePaths(group: WorkingTreeGroup, paths: string[]): string[] {
    const available = new Set(this.workingTreeCache[group].map((item) => item.path));
    const unique = [...new Set(paths)];
    if (unique.length === 0 || unique.some((path) => !available.has(path))) {
      throw new Error('The selected changes are stale; refresh and try again');
    }
    return unique;
  }

  private findCachedStash(selector: string, hash: string): StashEntry {
    const entry = this.stashCache.find(
      (candidate) => candidate.selector === selector && candidate.hash === hash
    );
    if (!entry) throw new Error('The selected stash is stale; refresh and try again');
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
