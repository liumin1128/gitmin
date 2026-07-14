/**
 * Webview message dispatch hub
 * Single entry point handle(), routes by type to corresponding business methods
 * Errors in business methods are uniformly converted to *error / action/result messages
 */
import * as vscode from "vscode";
import type {
  WebviewMessage,
  ExtensionMessage,
  GitWorkspaceOperation,
  RefreshTarget,
} from "../../shared/messages";
import type {
  Commit,
  CommitFilters,
  DetailSelection,
  DiffRange,
  FileChange,
  StashEntry,
  WorkingTreeGroup,
  WorkingTreeSnapshot,
} from "../../shared/domain";
import type { GitAction } from "../../shared/actions";
import { GitService, normalizeLogPagination } from "../services/GitService";
import { CommitRequestGuard } from "./CommitRequestGuard";
import { GitOpsService, type ResetMode } from "../services/GitOpsService";
import { FileDiffNavigator } from "../services/FileDiffNavigator";
import {
  getActiveRepo,
  getActiveRepository,
} from "../services/RepoLocator";
import { WorkingTreeService } from "../services/WorkingTreeService";
import { StashService } from "../services/StashService";
import { WorkingTreeDiffNavigator } from "../services/WorkingTreeDiffNavigator";
import { computeDiffRange } from "../utils/diffRange";
import { applySearch } from "../../shared/commitFilter";
import type { CommitPage } from "../../shared/commitPagination";
import {
  commitFiltersStateKey,
  parsePersistedCommitFilters,
} from "../../shared/persistedFilters";

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
  private workingTree: WorkingTreeService | null = null;
  private stashes: StashService | null = null;
  private workingTreeDiffNavigator: WorkingTreeDiffNavigator | null = null;
  private commitsCache: Commit[] = [];
  private workingTreeCache: WorkingTreeSnapshot = {
    conflicts: [],
    staged: [],
    changes: [],
  };
  private stashCache: StashEntry[] = [];
  private repoRoot: string | null = null;
  private lastFilters: CommitFilters | undefined = undefined;
  private readonly commitRequestGuard = new CommitRequestGuard();
  private commitContinuation: CommitContinuation | null = null;
  private diffCache: { range: DiffRange; files: FileChange[] } | null = null;
  private latestWorkingTreeRequestId = 0;
  private latestStashRequestId = 0;
  private latestSelectionRequestId = 0;
  private repositoryChangeTimer: NodeJS.Timeout | null = null;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly post: PostMessage,
    private readonly extensionUri: vscode.Uri,
    private readonly fileDiffNavigator: FileDiffNavigator,
    private readonly workspaceState: vscode.Memento,
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
    );
  }

  dispose(): void {
    if (this.repositoryChangeTimer) clearTimeout(this.repositoryChangeTimer);
    this.workingTreeDiffNavigator?.dispose();
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  async handle(msg: WebviewMessage): Promise<void> {
    try {
      switch (msg.type) {
        case "webview/ready": {
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
          await this.loadWorkingTree(msg.requestId);
          break;
        case "workingTree/action":
          await this.handleWorkingTreeAction(msg);
          break;
        case "workingTree/commit":
          await this.handleWorkingTreeCommit(msg.requestId, msg.message);
          break;
        case "workingTree/stash":
          await this.handleWorkingTreeStash(msg.requestId, msg.message);
          break;
        case "workingTree/openDiff":
          await this.openWorkingTreeDiff(msg.group, msg.path);
          break;
        case "stashes/request":
          await this.loadStashes(msg.requestId);
          break;
        case "stashes/action":
          await this.handleStashAction(msg);
          break;
        case "selectionDetails/request":
          await this.loadSelectionDetails(msg.requestId, msg.selection);
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
    const repo = await getActiveRepo();
    if (!this.isReservedCommitRequest(ready)) return;
    if (!repo) {
      this.post({
        type: "repo/none",
        reason: "No git repository detected in the current workspace",
      });
      this.commitRequestGuard.release(ready.requestId, ready.offset);
      return;
    }
    this.repoRoot = repo.rootPath;
    this.git = new GitService(repo.rootPath);
    this.ops = new GitOpsService(repo.rootPath, this.extensionUri);
    this.workingTree = new WorkingTreeService(repo.rootPath);
    this.stashes = new StashService(repo.rootPath, this.git);
    this.workingTreeDiffNavigator = new WorkingTreeDiffNavigator(repo.rootPath);
    const repository = await getActiveRepository();
    if (repository?.rootUri.fsPath === repo.rootPath) {
      this.disposables.push(
        repository.state.onDidChange(() => this.scheduleWorkingTreeChanged()),
      );
    }
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
    if (!this.git) return;
    try {
      const [branches, authors] = await Promise.all([
        this.git.getBranches(),
        this.git.getAuthors(),
      ]);
      this.post({ type: "filters/options", options: { branches, authors } });
    } catch (e) {
      console.error("[gitmin] loadFilterOptions error:", e);
    }
  }

  private async loadCommitDetails(hashes: string[]): Promise<void> {
    if (!this.git) return;
    try {
      const details = await this.git.getCommitDetails(hashes);
      this.post({ type: "commitDetails/loaded", hashes, details });
    } catch (error) {
      this.post({
        type: "commitDetails/error",
        hashes,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async loadDiff(hashes: string[]): Promise<void> {
    if (!this.git) return;
    const range = computeDiffRange(hashes, this.commitsCache);
    if (!range) return;
    this.fileDiffNavigator.clear();
    this.diffCache = null;
    this.post({ type: "diff/activeFile", filePath: null });
    try {
      const files = await this.git.getDiffSummary(range.base, range.head);
      this.diffCache = { range, files };
      this.post({ type: "diff/loaded", range, files });
    } catch (e) {
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

  private async loadWorkingTree(requestId: number): Promise<void> {
    this.latestWorkingTreeRequestId = Math.max(
      this.latestWorkingTreeRequestId,
      requestId,
    );
    if (!this.workingTree) {
      this.post({
        type: "workingTree/error",
        requestId,
        error: "Repository is not ready",
      });
      return;
    }
    try {
      const snapshot = await this.workingTree.getSnapshot();
      if (requestId !== this.latestWorkingTreeRequestId) return;
      this.workingTreeCache = snapshot;
      this.post({ type: "workingTree/loaded", requestId, snapshot });
    } catch (error) {
      if (requestId !== this.latestWorkingTreeRequestId) return;
      this.post({
        type: "workingTree/error",
        requestId,
        error: errorMessage(error),
      });
    }
  }

  private async openWorkingTreeDiff(
    group: WorkingTreeGroup,
    path: string,
  ): Promise<void> {
    if (!this.workingTreeDiffNavigator) return;
    this.fileDiffNavigator.clear();
    await this.workingTreeDiffNavigator.open(
      this.workingTreeCache,
      group,
      path,
    );
  }

  private scheduleWorkingTreeChanged(): void {
    if (this.repositoryChangeTimer) clearTimeout(this.repositoryChangeTimer);
    this.repositoryChangeTimer = setTimeout(() => {
      this.repositoryChangeTimer = null;
      this.post({ type: "workingTree/changed" });
    }, 100);
  }

  private async loadStashes(requestId: number): Promise<void> {
    this.latestStashRequestId = Math.max(this.latestStashRequestId, requestId);
    if (!this.stashes) {
      this.post({
        type: "stashes/error",
        requestId,
        error: "Repository is not ready",
      });
      return;
    }
    try {
      const entries = await this.stashes.listRecent(10);
      if (requestId !== this.latestStashRequestId) return;
      this.stashCache = entries;
      this.post({ type: "stashes/loaded", requestId, entries });
    } catch (error) {
      if (requestId !== this.latestStashRequestId) return;
      this.post({
        type: "stashes/error",
        requestId,
        error: errorMessage(error),
      });
    }
  }

  private async handleWorkingTreeAction(
    msg: Extract<WebviewMessage, { type: "workingTree/action" }>,
  ): Promise<void> {
    if (!this.workingTree) {
      this.postWorkspaceResult(
        msg.requestId,
        msg.action,
        false,
        [],
        "Repository is not ready",
      );
      return;
    }

    try {
      const paths = this.validateWorkingTreePaths(msg.group, msg.paths);
      if (msg.action === "discard") {
        const answer = await vscode.window.showWarningMessage(
          `Discard changes in ${paths.length} selected file(s)? This cannot be undone.`,
          { modal: true },
          "Discard",
        );
        if (answer !== "Discard") {
          this.postWorkspaceResult(
            msg.requestId,
            msg.action,
            false,
            [],
            "Cancelled",
          );
          return;
        }
      }

      if (msg.action === "stage") await this.workingTree.stage(paths);
      else if (msg.action === "unstage") await this.workingTree.unstage(paths);
      else await this.workingTree.discard(msg.group, paths);
      this.postWorkspaceResult(msg.requestId, msg.action, true, ["changes"]);
    } catch (error) {
      this.postWorkspaceResult(
        msg.requestId,
        msg.action,
        false,
        ["changes"],
        errorMessage(error),
      );
    }
  }

  private async handleWorkingTreeCommit(
    requestId: number,
    message: string,
  ): Promise<void> {
    try {
      if (!this.workingTree) throw new Error("Repository is not ready");
      await this.workingTree.commit(message);
      this.postWorkspaceResult(requestId, "commit", true, [
        "changes",
        "commits",
      ]);
    } catch (error) {
      this.postWorkspaceResult(
        requestId,
        "commit",
        false,
        ["changes"],
        errorMessage(error),
      );
    }
  }

  private async handleWorkingTreeStash(
    requestId: number,
    message: string,
  ): Promise<void> {
    try {
      if (!this.workingTree) throw new Error("Repository is not ready");
      const output = (await this.workingTree.createStash(message)).trim();
      this.postWorkspaceResult(
        requestId,
        "stash",
        true,
        ["changes", "stashes"],
        output || undefined,
      );
    } catch (error) {
      this.postWorkspaceResult(
        requestId,
        "stash",
        false,
        ["changes", "stashes"],
        errorMessage(error),
      );
    }
  }

  private async handleStashAction(
    msg: Extract<WebviewMessage, { type: "stashes/action" }>,
  ): Promise<void> {
    const operation: GitWorkspaceOperation =
      msg.action === "apply" ? "apply-stash" : "delete-stash";
    try {
      if (!this.stashes) throw new Error("Repository is not ready");
      const entry = this.findCachedStash(msg.selector, msg.hash);
      if (msg.action === "delete") {
        const answer = await vscode.window.showWarningMessage(
          `Delete ${entry.selector}? This cannot be undone.`,
          { modal: true },
          "Delete",
        );
        if (answer !== "Delete") {
          this.postWorkspaceResult(
            msg.requestId,
            operation,
            false,
            [],
            "Cancelled",
          );
          return;
        }
        await this.stashes.deleteVerified(entry);
        this.postWorkspaceResult(msg.requestId, operation, true, ["stashes"]);
        return;
      }

      await this.stashes.apply(entry.hash);
      this.postWorkspaceResult(msg.requestId, operation, true, ["changes"]);
    } catch (error) {
      this.postWorkspaceResult(
        msg.requestId,
        operation,
        false,
        msg.action === "apply" ? ["changes"] : ["stashes"],
        errorMessage(error),
      );
    }
  }

  private async loadSelectionDetails(
    requestId: number,
    selection: DetailSelection,
  ): Promise<void> {
    this.latestSelectionRequestId = Math.max(
      this.latestSelectionRequestId,
      requestId,
    );
    try {
      if (!this.git) throw new Error("Repository is not ready");
      let range: DiffRange;
      let files: FileChange[];
      let details;

      if (selection.kind === "commits") {
        const commitRange = computeDiffRange(
          selection.hashes,
          this.commitsCache,
        );
        if (!commitRange) throw new Error("Selected commits are unavailable");
        range = commitRange;
        [files, details] = await Promise.all([
          this.git.getDiffSummary(range.base, range.head),
          this.git.getCommitDetails(selection.hashes),
        ]);
      } else {
        if (!this.stashes) throw new Error("Repository is not ready");
        const entry = this.findCachedStash(selection.selector, selection.hash);
        const stashDetails = await this.stashes.getDetails(entry);
        range = stashDetails.range;
        files = stashDetails.files;
        details = stashDetails.details;
      }

      if (requestId !== this.latestSelectionRequestId) return;
      this.fileDiffNavigator.clear();
      this.diffCache = { range, files };
      this.post({ type: "diff/activeFile", filePath: null });
      this.post({
        type: "selectionDetails/loaded",
        requestId,
        selection,
        range,
        files,
        details,
      });
    } catch (error) {
      if (requestId !== this.latestSelectionRequestId) return;
      this.post({
        type: "selectionDetails/error",
        requestId,
        selection,
        error: errorMessage(error),
      });
    }
  }

  private validateWorkingTreePaths(
    group: WorkingTreeGroup,
    paths: string[],
  ): string[] {
    const available = new Set(this.workingTreeCache[group].map((item) => item.path));
    const unique = [...new Set(paths)];
    if (unique.length === 0 || unique.some((path) => !available.has(path))) {
      throw new Error("The selected changes are stale; refresh and try again");
    }
    return unique;
  }

  private findCachedStash(selector: string, hash: string): StashEntry {
    const entry = this.stashCache.find(
      (candidate) => candidate.selector === selector && candidate.hash === hash,
    );
    if (!entry) throw new Error("The selected stash is stale; refresh and try again");
    return entry;
  }

  private postWorkspaceResult(
    requestId: number,
    operation: GitWorkspaceOperation,
    ok: boolean,
    refresh: RefreshTarget[],
    message?: string,
  ): void {
    this.post({
      type: "workingTree/actionResult",
      requestId,
      operation,
      ok,
      refresh,
      ...(message ? { message } : {}),
    });
  }

  private async handleAction(
    msg: Extract<WebviewMessage, { type: "action/execute" }>,
  ): Promise<void> {
    if (!this.ops) return;
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
      switch (action) {
        case "copy-hash":
          await this.ops.copyHash(hashes);
          break;
        case "revert":
          await this.ops.revert(hashes, this.commitsCache);
          break;
        case "squash":
          await this.ops.squash(
            hashes,
            this.commitsCache,
            msg.squashMessage ?? "squash",
          );
          break;
        case "drop":
          await this.ops.drop(hashes, this.commitsCache);
          break;
        case "reset-soft":
        case "reset-mixed":
        case "reset-hard": {
          if (hashes.length !== 1)
            throw new Error("reset requires single selection");
          const mode = action.slice("reset-".length) as ResetMode;
          await this.ops.reset(mode, hashes[0]!);
          break;
        }
      }
      this.post({ type: "action/result", action, ok: true });
      if (action === "copy-hash") {
        vscode.window.showInformationMessage(
          `Copied ${hashes.length} hash(es) to clipboard`,
        );
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.post({ type: "action/result", action, ok: false, message: err });
      vscode.window.showErrorMessage(`Git operation failed: ${err}`);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
