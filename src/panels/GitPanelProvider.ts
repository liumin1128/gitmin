/**
 * WebviewPanel singleton: opens a wider commit panel in the editor area
 * Alternative large-screen entry point when the sidebar is too narrow
 */
import * as vscode from "vscode";
import { MessageHandler } from "../ipc/MessageHandler";
import { FileDiffNavigator } from "../services/FileDiffNavigator";
import { RepositorySelectionService } from "../services/RepositorySelectionService";
import { buildWebviewHtml } from "../utils/webviewHtml";
import type { WebviewMessage } from "../../shared/messages";

export class GitPanelProvider {
  private static current: GitPanelProvider | undefined;

  static show(
    context: vscode.ExtensionContext,
    fileDiffNavigator: FileDiffNavigator,
    repositorySelection: RepositorySelectionService,
  ): void {
    if (GitPanelProvider.current) {
      GitPanelProvider.current.panel.reveal(vscode.ViewColumn.Active);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "gitmin.panel",
      "Git Commit Panel",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "out")],
      },
    );
    GitPanelProvider.current = new GitPanelProvider(
      panel,
      context.extensionUri,
      fileDiffNavigator,
      context.workspaceState,
      repositorySelection,
    );
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    fileDiffNavigator: FileDiffNavigator,
    workspaceState: vscode.Memento,
    repositorySelection: RepositorySelectionService,
  ) {
    this.panel.webview.html = buildWebviewHtml(
      this.panel.webview,
      extensionUri,
      "panel",
    );
    const handler = new MessageHandler(
      (msg) => {
        this.panel.webview.postMessage(msg);
      },
      extensionUri,
      fileDiffNavigator,
      workspaceState,
      repositorySelection,
    );
    const messageSubscription = this.panel.webview.onDidReceiveMessage(
      (raw: WebviewMessage) => {
        void handler.handle(raw);
      },
    );
    this.panel.onDidDispose(() => {
      messageSubscription.dispose();
      handler.dispose();
      GitPanelProvider.current = undefined;
    });
  }
}
