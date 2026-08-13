import * as vscode from "vscode";
import type { DiffRange, FileChange } from "../../shared/domain";
import { getGitApi, type GitApi } from "./RepoLocator";
import { getAdjacentFileChange } from "../utils/diffNavigation";
import { diffSideRef, type DiffSide } from "../utils/diffRange";

interface NavigationSession {
  repoRoot: string;
  range: DiffRange;
  files: FileChange[];
  filePath: string;
}

export interface ActiveDiffFile {
  range: DiffRange;
  filePath: string | null;
}

export class FileDiffNavigator implements vscode.Disposable {
  private session: NavigationSession | null = null;
  private activeResources = new Set<string>();
  private readonly activeFileEmitter =
    new vscode.EventEmitter<ActiveDiffFile>();
  private readonly activeEditorSubscription: vscode.Disposable;

  readonly onDidChangeActiveFile = this.activeFileEmitter.event;

  constructor() {
    this.activeEditorSubscription = vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        const active =
          !!editor && this.activeResources.has(editor.document.uri.toString());
        void vscode.commands.executeCommand(
          "setContext",
          "gitmin.fileDiffActive",
          active,
        );
        if (this.session) {
          this.activeFileEmitter.fire({
            range: this.session.range,
            filePath: active ? this.session.filePath : null,
          });
        }
      },
    );
  }

  async open(
    repoRoot: string,
    range: DiffRange,
    files: FileChange[],
    filePath: string,
  ): Promise<void> {
    if (!files.some((file) => file.path === filePath)) return;
    this.session = { repoRoot, range, files, filePath };
    await this.openCurrentFile();
  }

  async navigate(offset: -1 | 1): Promise<void> {
    if (!this.session) return;
    const file = getAdjacentFileChange(
      this.session.files,
      this.session.filePath,
      offset,
    );
    if (!file) return;
    this.session.filePath = file.path;
    await this.openCurrentFile();
  }

  clear(): void {
    if (this.session) {
      this.activeFileEmitter.fire({
        range: this.session.range,
        filePath: null,
      });
    }
    this.session = null;
    this.activeResources.clear();
    void vscode.commands.executeCommand(
      "setContext",
      "gitmin.fileDiffActive",
      false,
    );
  }

  dispose(): void {
    this.clear();
    this.activeEditorSubscription.dispose();
    this.activeFileEmitter.dispose();
  }

  private async openCurrentFile(): Promise<void> {
    const session = this.session;
    if (!session) return;
    const filePath = session.filePath;
    const api = await getGitApi();
    if (!api || this.session !== session || session.filePath !== filePath)
      return;

    const file = session.files.find((item) => item.path === filePath);
    if (!file) return;
    const rootUri = vscode.Uri.file(session.repoRoot);
    const originalUri = this.toUri(
      api,
      rootUri,
      file,
      "left",
      session.range.base,
    );
    const modifiedUri = this.toUri(
      api,
      rootUri,
      file,
      "right",
      session.range.head,
    );
    const title = `${file.path} (${session.range.base.slice(0, 7)}..${session.range.head.slice(0, 7)})`;

    this.activeResources = new Set([
      originalUri.toString(),
      modifiedUri.toString(),
    ]);
    this.activeFileEmitter.fire({ range: session.range, filePath: file.path });
    void vscode.commands.executeCommand(
      "setContext",
      "gitmin.fileDiffActive",
      true,
    );
    await vscode.commands.executeCommand(
      "vscode.diff",
      originalUri,
      modifiedUri,
      title,
    );
  }

  private toUri(
    api: GitApi,
    rootUri: vscode.Uri,
    file: FileChange,
    side: DiffSide,
    ref: string,
  ): vscode.Uri {
    const path = side === "left" ? (file.oldPath ?? file.path) : file.path;
    const fileUri = vscode.Uri.joinPath(rootUri, path);
    return api.toGitUri(fileUri, diffSideRef(file.status, side, ref));
  }
}
