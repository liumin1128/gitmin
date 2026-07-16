/**
 * Webview message dispatch hub
 * Single entry point handle(), routes by type to corresponding business methods
 * Errors in business methods are uniformly converted to *error / action/result messages
 */
import * as vscode from "vscode";
import type {
  WebviewMessage,
  ExtensionMessage,
} from "../../shared/messages";
import type {
  Commit,
  CommitFilters,
  DiffRange,
  FileChange,
} from "../../shared/domain";
import type { GitAction } from "../../shared/actions";
import { GitService, normalizeLogPagination } from "../services/GitService";
import { CommitRequestGuard } from "./CommitRequestGuard";
import { GitOpsService, type ResetMode } from "../services/GitOpsService";
import { FileDiffNavigator } from "../services/FileDiffNavigator";
import {
  RepositorySelectionService,
  type RepositorySelectionChange,
} from "../services/RepositorySelectionService";
import { computeDiffRange } from "../utils/diffRange";
import { applySearch } from "../../shared/commitFilter";
import type { CommitPage } from "../../shared/commitPagination";
import {
  commitFiltersStateKey,
  parsePersistedCommitFilters,
} from "../../shared/persistedFilters";
import { WorkspaceMessageController } from "./WorkspaceMessageController";

export type PostMessage = (msg: ExtensionMessage) => void;

type CommitLoadRequest = {
  requestId: number;
  offset: number;
  limit: number;
  filters?: CommitFilters;
};

type CommitContinuation = {
  requestId: number;
  expectedOffset: number;
  raw: Commit[];
  nextRawOffset: number;
};

export class MessageHandler implements vscode.Disposable {
  private git: GitService | null = null;
  private ops: GitOpsService | null = null;
  private workspaceController: WorkspaceMessageController | null = null;
  private commitsCache: Commit[] = [];
  private repoRoot: string | null = null;
  private lastFilters: CommitFilters | undefined = undefined;
  private readonly commitRequestGuard = new CommitRequestGuard();
  private commitContinuation: CommitContinuation | null = null;
  private diffCache: { range: DiffRange; files: FileChange[] } | null = null;
  private repositoryGeneration = 0;
  private webviewReady = false;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly post: PostMessage,
    private readonly extensionUri: vscode.Uri,
    private readonly fileDiffNavigator: FileDiffNavigator,
    private readonly workspaceState: vscode.Memento,
    private readonly repositorySelection: RepositorySelectionService,
  ) {
    this.disposables.push(
      this.fileDiffNavigator.onDidChangeActiveFile(({ range, filePath }) => {
        if (
          this.diffCache?.range.base === range.base &&
          this.diffCache.range.head === range.head
        ) {
          this.post({ type: "diff/activeFile", filePath });
        }
      }),
      this.repositorySelection.onDidChange((change) =>
        this.handleRepositorySelectionChange(change),
      ),
    );
  }

  dispose(): void {
    this.webviewReady = false;
    this.clearRepositoryContext();
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  async handle(msg: WebviewMessage): Promise<void> {
    try {
      switch (msg.type) {
        case "webview/ready": {
          const request = this.normalizeCommitRequest({ ...msg, offset: 0 });
          if (!this.reserveCommitRequest(request)) return;
          await this.repositorySelection.initialize();
          if (!this.isReservedCommitRequest(request)) return;
          this.webviewReady = true;
          this.postRepositorySnapshot();
          await this.initRepo(request);
          break;
        }
        case "repositories/select":
          try {
            await this.repositorySelection.select(msg.rootPath);
          } catch (error) {
            this.post({
              type: "repositories/error",
              error: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case "repositories/load": {
          const request = this.normalizeCommitRequest({ ...msg, offset: 0 });
          if (!this.reserveCommitRequest(request)) return;
          await this.initRepo(request);
          break;
        }
        case "commits/refresh": {
          const request = this.normalizeCommitRequest(msg);
          if (!this.reserveCommitRequest(request)) return;
          await this.persistFilters(request.filters);
          if (!this.isReservedCommitRequest(request)) return;
          await this.loadCommits(request);
          break;
        }
        case "filters/refresh":
          await this.loadFilterOptions();
          break;
        case "commitDetails/request":
          await this.loadCommitDetails(msg.hashes);
          break;
        case "diff/request":
          await this.loadDiff(msg.hashes);
          break;
        case "file/openDiff":
          await this.openFileDiff(msg.range, msg.filePath);
          break;
        case "workingTree/request":
          await this.workspaceController?.loadWorkingTree(msg.requestId);
          break;
        case "workingTree/action":
          await this.workspaceController?.handleWorkingTreeAction(msg);
          break;
        case "workingTree/commit":
          await this.workspaceController?.handleCommit(msg.requestId, msg.message);
          break;
        case "workingTree/generateCommitMessage":
          await this.workspaceController?.handleGenerateCommitMessage(msg.requestId);
          break;
        case "workingTree/stash":
          await this.workspaceController?.handleCreateStash(msg.requestId, msg.message);
          break;
        case "workingTree/openDiff":
          await this.workspaceController?.openWorkingTreeDiff(msg.group, msg.path);
          break;
        case "stashes/request":
          await this.workspaceController?.loadStashes(msg.requestId);
          break;
        case "stashes/action":
          await this.workspaceController?.handleStashAction(msg);
          break;
        case "selectionDetails/request":
          await this.workspaceController?.loadSelectionDetails(
            msg.requestId,
            msg.selection,
            this.commitsCache,
          );
          break;
        case "selectionDetails/clear":
          this.fileDiffNavigator.clear();
          this.diffCache = null;
          this.post({ type: "diff/activeFile", filePath: null });
          break;
        case "action/execute":
          await this.handleAction(msg);
          break;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[gitmin] handle error:", message);
    }
  }

  private async initRepo(ready: CommitLoadRequest): Promise<void> {
    const snapshot = this.repositorySelection.getSnapshot();
    const repo = snapshot.repositories.find(
      (repository) => repository.rootPath === snapshot.selectedRootPath,
    );
    if (!repo) {
      this.post({
        type: "repo/none",
        reason: "No git repository detected in the current workspace",
      });
      this.commitRequestGuard.release(ready.requestId, ready.offset);
      return;
    }
    this.clearRepositoryContext();
    const generation = this.repositoryGeneration;
    this.repoRoot = repo.rootPath;
    this.git = new GitService(repo.rootPath);
    this.ops = new GitOpsService(repo.rootPath, this.extensionUri);
    this.workspaceController = new WorkspaceMessageController(
      repo.rootPath,
      this.git,
      (message) => {
        if (this.repositoryGeneration === generation) this.post(message);
      },
      this.fileDiffNavigator,
      (range, files) => {
        this.diffCache = { range, files };
      },
    );
    await this.workspaceController.initialize();
    if (
      generation !== this.repositoryGeneration ||
      !this.isReservedCommitRequest(ready)
    )
      return;
    const stateKey = commitFiltersStateKey(repo.rootPath);
    const storedFilters = this.workspaceState.get<unknown>(stateKey);
    const filters = parsePersistedCommitFilters(
      storedFilters === undefined ? ready.filters : storedFilters,
    );
    if (storedFilters === undefined && ready.filters) {
      await this.persistFilters(filters);
      if (!this.isReservedCommitRequest(ready)) return;
    }
    this.post({
      type: "repo/info",
      info: {
        rootPath: repo.rootPath,
        currentBranch: repo.currentBranch,
        hasCommits: true,
      },
    });
    this.post({ type: "filters/restored", filters });
    await this.loadCommits({
      requestId: ready.requestId,
      offset: 0,
      limit: ready.limit,
      filters,
    });
    await this.loadFilterOptions();
  }

  private handleRepositorySelectionChange(
    change: RepositorySelectionChange,
  ): void {
    if (!this.webviewReady) return;
    this.post({
      type: "repositories/loaded",
      snapshot: {
        repositories: change.repositories,
        selectedRootPath: change.selectedRootPath,
      },
    });
    if (!change.selectionChanged) return;

    this.commitRequestGuard.reset();
    this.clearRepositoryContext();
    this.fileDiffNavigator.clear();
    this.post({
      type: "repositories/selectionChanged",
      rootPath: change.selectedRootPath,
    });
    if (!change.selectedRootPath) {
      this.post({
        type: "repo/none",
        reason: "No git repository detected in the current workspace",
      });
    }
  }

  private postRepositorySnapshot(): void {
    this.post({
      type: "repositories/loaded",
      snapshot: this.repositorySelection.getSnapshot(),
    });
  }

  private clearRepositoryContext(): void {
    this.repositoryGeneration += 1;
    this.workspaceController?.dispose();
    this.workspaceController = null;
    this.git = null;
    this.ops = null;
    this.repoRoot = null;
    this.commitsCache = [];
    this.lastFilters = undefined;
    this.commitContinuation = null;
    this.diffCache = null;
  }

  private async persistFilters(filters?: CommitFilters): Promise<void> {
    if (!this.repoRoot) return;
    try {
      await this.workspaceState.update(
        commitFiltersStateKey(this.repoRoot),
        parsePersistedCommitFilters(filters),
      );
    } catch (error) {
      console.error("[gitmin] persist filters error:", error);
    }
  }

  private async loadCommits(request: CommitLoadRequest): Promise<void> {
    if (!this.isReservedCommitRequest(request)) return;
    this.lastFilters = request.filters;
    if (!this.git) {
      this.commitRequestGuard.release(request.requestId, request.offset);
      return;
    }
    try {
      const result = await this.readCommitPage(request);
      if (!result || !this.isReservedCommitRequest(request)) return;

      const hasMore =
        result.commits.length > 0
          ? await this.prepareContinuation(request, result.nextOffset)
          : false;
      if (hasMore === undefined || !this.isReservedCommitRequest(request))
        return;

      if (request.offset === 0) {
        this.commitsCache = result.commits;
      } else {
        this.commitsCache = [...this.commitsCache, ...result.commits];
      }

      const page: CommitPage = {
        requestId: request.requestId,
        offset: request.offset,
        nextOffset: result.nextOffset,
        commits: result.commits,
        hasMore,
      };
      this.post({ type: "commits/loaded", page });
      this.commitRequestGuard.complete(
        request.requestId,
        request.offset,
        result.nextOffset,
      );
    } catch (e) {
      if (!this.isReservedCommitRequest(request)) return;
      this.post({
        type: "commits/error",
        requestId: request.requestId,
        error: e instanceof Error ? e.message : String(e),
      });
      this.commitRequestGuard.release(request.requestId, request.offset);
    }
  }

  private normalizeCommitRequest(
    request: CommitLoadRequest,
  ): CommitLoadRequest {
    const { limit, offset } = normalizeLogPagination(
      request.limit,
      request.offset,
    );
    return { ...request, limit, offset };
  }

  private reserveCommitRequest(request: CommitLoadRequest): boolean {
    const isReserved = this.commitRequestGuard.reserve(
      request.requestId,
      request.offset,
    );
    if (isReserved && request.offset === 0) {
      this.commitContinuation = null;
    }
    return isReserved;
  }

  private isReservedCommitRequest(request: CommitLoadRequest): boolean {
    return this.commitRequestGuard.isReserved(
      request.requestId,
      request.offset,
    );
  }

  private async readCommitPage(
    request: CommitLoadRequest,
  ): Promise<{ commits: Commit[]; nextOffset: number } | undefined> {
    const continuation = this.commitContinuation;
    if (
      continuation?.requestId === request.requestId &&
      continuation.expectedOffset === request.offset
    ) {
      this.commitContinuation = null;
      return {
        commits: applySearch(continuation.raw, request.filters),
        nextOffset: continuation.nextRawOffset,
      };
    }
    if (continuation?.requestId === request.requestId) {
      this.commitContinuation = null;
    }

    let rawOffset = request.offset;
    let raw: Commit[];
    let commits: Commit[];

    do {
      raw = await this.git!.getLog({
        offset: rawOffset,
        limit: request.limit,
        filters: request.filters,
      });
      if (!this.isReservedCommitRequest(request)) return undefined;
      commits = applySearch(raw, request.filters);
      rawOffset += raw.length;
    } while (commits.length === 0 && raw.length === request.limit);

    return { commits, nextOffset: rawOffset };
  }

  private async prepareContinuation(
    request: CommitLoadRequest,
    expectedOffset: number,
  ): Promise<boolean | undefined> {
    let rawOffset = expectedOffset;

    while (true) {
      const raw = await this.git!.getLog({
        offset: rawOffset,
        limit: request.limit,
        filters: request.filters,
      });
      if (!this.isReservedCommitRequest(request)) return undefined;

      if (applySearch(raw, request.filters).length > 0) {
        this.commitContinuation = {
          requestId: request.requestId,
          expectedOffset,
          raw,
          nextRawOffset: rawOffset + raw.length,
        };
        return true;
      }
      if (raw.length < request.limit) {
        this.commitContinuation = null;
        return false;
      }
      rawOffset += raw.length;
    }
  }

  private async loadFilterOptions(): Promise<void> {
    const git = this.git;
    const generation = this.repositoryGeneration;
    if (!git) return;
    try {
      const [branches, authors] = await Promise.all([
        git.getBranches(),
        git.getAuthors(),
      ]);
      if (generation !== this.repositoryGeneration) return;
      this.post({ type: "filters/options", options: { branches, authors } });
    } catch (e) {
      console.error("[gitmin] loadFilterOptions error:", e);
    }
  }

  private async loadCommitDetails(hashes: string[]): Promise<void> {
    const git = this.git;
    const generation = this.repositoryGeneration;
    if (!git) return;
    try {
      const details = await git.getCommitDetails(hashes);
      if (generation !== this.repositoryGeneration) return;
      this.post({ type: "commitDetails/loaded", hashes, details });
    } catch (error) {
      if (generation !== this.repositoryGeneration) return;
      this.post({
        type: "commitDetails/error",
        hashes,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async loadDiff(hashes: string[]): Promise<void> {
    const git = this.git;
    const generation = this.repositoryGeneration;
    if (!git) return;
    const range = computeDiffRange(hashes, this.commitsCache);
    if (!range) return;
    this.fileDiffNavigator.clear();
    this.diffCache = null;
    this.post({ type: "diff/activeFile", filePath: null });
    try {
      const files = await git.getDiffSummary(range.base, range.head);
      if (generation !== this.repositoryGeneration) return;
      this.diffCache = { range, files };
      this.post({ type: "diff/loaded", range, files });
    } catch (e) {
      if (generation !== this.repositoryGeneration) return;
      this.post({
        type: "diff/error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private async openFileDiff(
    range: DiffRange,
    filePath: string,
  ): Promise<void> {
    if (!this.repoRoot) return;
    if (
      !this.diffCache ||
      this.diffCache.range.base !== range.base ||
      this.diffCache.range.head !== range.head
    )
      return;
    await this.fileDiffNavigator.open(
      this.repoRoot,
      range,
      this.diffCache.files,
      filePath,
    );
  }

  private async handleAction(
    msg: Extract<WebviewMessage, { type: "action/execute" }>,
  ): Promise<void> {
    const ops = this.ops;
    const generation = this.repositoryGeneration;
    const commits = this.commitsCache;
    if (!ops) return;
    const { action, hashes } = msg;

    // reset --hard second confirmation (may lose working tree changes)
    if (action === "reset-hard") {
      const short = hashes[0]?.slice(0, 7) ?? "?";
      const answer = await vscode.window.showWarningMessage(
        `About to git reset --hard to ${short}, which will discard all uncommitted changes in the working tree. Continue?`,
        { modal: true },
        "Continue",
      );
      if (answer !== "Continue") {
        if (generation !== this.repositoryGeneration) return;
        this.post({
          type: "action/result",
          action,
          ok: false,
          message: "Cancelled",
        });
        return;
      }
    }

    try {
      if (generation !== this.repositoryGeneration) return;
      switch (action) {
        case "copy-hash":
          await ops.copyHash(hashes);
          break;
        case "revert":
          await ops.revert(hashes, commits);
          break;
        case "squash":
          await ops.squash(
            hashes,
            commits,
            msg.squashMessage ?? "squash",
          );
          break;
        case "drop":
          await ops.drop(hashes, commits);
          break;
        case "reset-soft":
        case "reset-mixed":
        case "reset-hard": {
          if (hashes.length !== 1)
            throw new Error("reset requires single selection");
          const mode = action.slice("reset-".length) as ResetMode;
          await ops.reset(mode, hashes[0]!);
          break;
        }
      }
      if (generation !== this.repositoryGeneration) return;
      this.post({ type: "action/result", action, ok: true });
      if (action === "copy-hash") {
        vscode.window.showInformationMessage(
          `Copied ${hashes.length} hash(es) to clipboard`,
        );
      }
    } catch (e) {
      if (generation !== this.repositoryGeneration) return;
      const err = e instanceof Error ? e.message : String(e);
      this.post({ type: "action/result", action, ok: false, message: err });
      vscode.window.showErrorMessage(`Git operation failed: ${err}`);
    }
  }
}
