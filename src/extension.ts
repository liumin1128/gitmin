import * as vscode from "vscode";
import { GitPanelProvider } from "./panels/GitPanelProvider";
import { GitPanelViewProvider } from "./panels/GitPanelViewProvider";
import { FileDiffNavigator } from "./services/FileDiffNavigator";
import {
  WORKBENCH_VIEW_IDS,
  WORKBENCH_VIEW_METADATA,
} from "../shared/workbenchViews";

export function activate(context: vscode.ExtensionContext) {
  const fileDiffNavigator = new FileDiffNavigator();
  const viewProvider = new GitPanelViewProvider(
    context.extensionUri,
    fileDiffNavigator,
    context.workspaceState,
  );
  context.subscriptions.push(
    fileDiffNavigator,
    vscode.window.registerWebviewViewProvider(
      GitPanelViewProvider.VIEW_ID,
      viewProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    vscode.commands.registerCommand("gitmin.openPanel", () => {
      GitPanelProvider.show(context, fileDiffNavigator);
    }),
    vscode.commands.registerCommand("gitmin.previousFileDiff", () =>
      fileDiffNavigator.navigate(-1),
    ),
    vscode.commands.registerCommand("gitmin.nextFileDiff", () =>
      fileDiffNavigator.navigate(1),
    ),
    ...WORKBENCH_VIEW_IDS.map((id) =>
      vscode.commands.registerCommand(
        WORKBENCH_VIEW_METADATA[id].toggleCommand,
        () => viewProvider.toggleWorkbenchView(id),
      ),
    ),
  );
}

export function deactivate() {
  // no-op
}
