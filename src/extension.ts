import * as vscode from 'vscode';
import { GitPanelProvider } from './panels/GitPanelProvider';
import { GitPanelViewProvider } from './panels/GitPanelViewProvider';
import { FileDiffNavigator } from './services/FileDiffNavigator';

export function activate(context: vscode.ExtensionContext) {
  const fileDiffNavigator = new FileDiffNavigator();
  const viewProvider = new GitPanelViewProvider(
    context.extensionUri,
    fileDiffNavigator,
    context.workspaceState
  );
  context.subscriptions.push(
    fileDiffNavigator,
    vscode.window.registerWebviewViewProvider(
      GitPanelViewProvider.VIEW_ID,
      viewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.commands.registerCommand('gitMgr.openPanel', () => {
      GitPanelProvider.show(context, fileDiffNavigator);
    }),
    vscode.commands.registerCommand('gitMgr.previousFileDiff', () =>
      fileDiffNavigator.navigate(-1)
    ),
    vscode.commands.registerCommand('gitMgr.nextFileDiff', () =>
      fileDiffNavigator.navigate(1)
    )
  );
}

export function deactivate() {
  // no-op
}
