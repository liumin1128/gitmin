/**
 * Sidebar Webview view provider
 * Main entry point: clicking the icon in the Activity Bar shows the commit list
 */
import * as vscode from "vscode";
import { MessageHandler } from "../ipc/MessageHandler";
import { FileDiffNavigator } from "../services/FileDiffNavigator";
import { buildWebviewHtml } from "../utils/webviewHtml";
import type { WebviewMessage } from "../../shared/messages";
import {
  WORKBENCH_VIEW_IDS,
  WORKBENCH_VIEW_METADATA,
  type WorkbenchViewId,
  type WorkbenchViewVisibility,
} from "../../shared/workbenchViews";

export class GitPanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly VIEW_ID = "gitmin.panel";
  private view: vscode.WebviewView | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly fileDiffNavigator: FileDiffNavigator,
    private readonly workspaceState: vscode.Memento,
  ) {}

  toggleWorkbenchView(id: WorkbenchViewId): void {
    void this.view?.webview.postMessage({ type: "workbenchViews/toggle", id });
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "out")],
    };
    view.webview.html = buildWebviewHtml(view.webview, this.extensionUri, "view");

    const handler = new MessageHandler(
      (msg) => {
        view.webview.postMessage(msg);
      },
      this.extensionUri,
      this.fileDiffNavigator,
      this.workspaceState,
    );
    const sub = view.webview.onDidReceiveMessage((raw: WebviewMessage) => {
      if (raw.type === "workbenchViews/visibility") {
        this.updateVisibilityContexts(raw.visibility);
        return;
      }
      void handler.handle(raw);
    });
    view.onDidDispose(() => {
      if (this.view === view) this.view = undefined;
      sub.dispose();
      handler.dispose();
    });
  }

  private updateVisibilityContexts(visibility: WorkbenchViewVisibility): void {
    for (const id of WORKBENCH_VIEW_IDS) {
      void vscode.commands.executeCommand(
        "setContext",
        WORKBENCH_VIEW_METADATA[id].visibilityContext,
        visibility[id],
      );
    }
  }
}
