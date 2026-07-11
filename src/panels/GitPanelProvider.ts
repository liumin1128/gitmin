/**
 * WebviewPanel 单例：在编辑区打开更宽敞的 commit 面板
 * 侧边栏窄时的备用大屏入口
 */
import * as vscode from 'vscode';
import { MessageHandler } from '../ipc/MessageHandler';
import { FileDiffNavigator } from '../services/FileDiffNavigator';
import { buildWebviewHtml } from '../utils/webviewHtml';
import type { WebviewMessage } from '../../shared/messages';

export class GitPanelProvider {
  private static current: GitPanelProvider | undefined;

  static show(context: vscode.ExtensionContext, fileDiffNavigator: FileDiffNavigator): void {
    if (GitPanelProvider.current) {
      GitPanelProvider.current.panel.reveal(vscode.ViewColumn.Active);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'gitMgr.panel',
      'Git Commit Panel',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'out')],
      }
    );
    GitPanelProvider.current = new GitPanelProvider(
      panel,
      context.extensionUri,
      fileDiffNavigator
    );
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    fileDiffNavigator: FileDiffNavigator
  ) {
    this.panel.webview.html = buildWebviewHtml(this.panel.webview, extensionUri);
    const handler = new MessageHandler((msg) => {
      this.panel.webview.postMessage(msg);
    }, extensionUri, fileDiffNavigator);
    const messageSubscription = this.panel.webview.onDidReceiveMessage((raw: WebviewMessage) => {
      void handler.handle(raw);
    });
    this.panel.onDidDispose(() => {
      messageSubscription.dispose();
      handler.dispose();
      GitPanelProvider.current = undefined;
    });
  }
}
