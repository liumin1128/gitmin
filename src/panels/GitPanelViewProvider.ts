/**
 * Sidebar Webview view provider
 * Main entry point: clicking the icon in the Activity Bar shows the commit list
 */
import * as vscode from "vscode";
import { MessageHandler } from "../ipc/MessageHandler";
import { FileDiffNavigator } from "../services/FileDiffNavigator";
import { RepositorySelectionService } from "../services/RepositorySelectionService";
import { CommitMessageGenerator } from "../services/CommitMessageGenerator";
import { buildWebviewHtml } from "../utils/webviewHtml";
import type { ExtensionMessage, WebviewMessage } from "../../shared/messages";
import { workingTreeChangeCount } from "../../shared/workingTree";
import { t } from "../../shared/i18n";

export class GitPanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly VIEW_ID = "gitmin.panel";
  private view: vscode.WebviewView | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly fileDiffNavigator: FileDiffNavigator,
    private readonly workspaceState: vscode.Memento,
    private readonly repositorySelection: RepositorySelectionService,
    private readonly commitMessageGenerator: CommitMessageGenerator,
  ) {}

  toggleWorkbenchViewMenu(): void {
    void this.view?.webview.postMessage({ type: "workbenchViews/menuToggle" });
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "out")],
    };

    const handler = new MessageHandler(
      (msg) => {
        this.updateBadge(view, msg);
        void view.webview.postMessage(msg);
      },
      this.extensionUri,
      this.fileDiffNavigator,
      this.workspaceState,
      this.repositorySelection,
      this.commitMessageGenerator,
    );
    const sub = view.webview.onDidReceiveMessage((raw: WebviewMessage) =>
      void handler.handle(raw),
    );
    view.webview.html = buildWebviewHtml(view.webview, this.extensionUri, "view");
    view.onDidDispose(() => {
      if (this.view === view) this.view = undefined;
      sub.dispose();
      handler.dispose();
    });
  }

  private updateBadge(view: vscode.WebviewView, message: ExtensionMessage): void {
    if (message.type === "workingTree/loaded") {
      const count = workingTreeChangeCount(message.snapshot);
      view.badge = count > 0
        ? { value: count, tooltip: t("changes.countBadge", { count }) }
        : undefined;
      return;
    }

    if (
      message.type === "repositories/selectionChanged" ||
      message.type === "repo/none"
    ) {
      view.badge = undefined;
    }
  }
}
