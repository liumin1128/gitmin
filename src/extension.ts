import * as vscode from 'vscode';
import { GitPanelProvider } from './panels/GitPanelProvider';
import { GitPanelViewProvider } from './panels/GitPanelViewProvider';

export function activate(context: vscode.ExtensionContext) {
  const viewProvider = new GitPanelViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GitPanelViewProvider.VIEW_ID,
      viewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.commands.registerCommand('gitMgr.openPanel', () => {
      GitPanelProvider.show(context);
    })
  );
}

export function deactivate() {
  // no-op
}
