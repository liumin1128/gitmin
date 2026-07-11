/**
 * Sidebar Webview view provider
 * Main entry point: clicking the icon in the Activity Bar shows the commit list
 */
import * as vscode from 'vscode';
import { MessageHandler } from '../ipc/MessageHandler';
import { FileDiffNavigator } from '../services/FileDiffNavigator';
import { buildWebviewHtml } from '../utils/webviewHtml';
import type { WebviewMessage } from '../../shared/messages';

export class GitPanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly VIEW_ID = 'gitMgr.panel';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly fileDiffNavigator: FileDiffNavigator,
    private readonly workspaceState: vscode.Memento
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out')],
    };
    view.webview.html = buildWebviewHtml(view.webview, this.extensionUri);

    const handler = new MessageHandler((msg) => {
      view.webview.postMessage(msg);
    }, this.extensionUri, this.fileDiffNavigator, this.workspaceState);
    const sub = view.webview.onDidReceiveMessage((raw: WebviewMessage) => {
      void handler.handle(raw);
    });
    view.onDidDispose(() => {
      sub.dispose();
      handler.dispose();
    });
  }
}
