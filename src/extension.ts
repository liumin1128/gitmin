import * as vscode from "vscode";
import { GitPanelProvider } from "./panels/GitPanelProvider";
import { GitPanelViewProvider } from "./panels/GitPanelViewProvider";
import { FileDiffNavigator } from "./services/FileDiffNavigator";
import { getGitApi } from "./services/RepoLocator";
import { RepositorySelectionService } from "./services/RepositorySelectionService";
import { CopilotModelSelector } from "./services/CopilotModelSelector";
import { CommitMessageGenerator } from "./services/CommitMessageGenerator";
import { CustomModelCredentials } from "./services/CustomModelCredentials";
import { OpenAICompatibleClient } from "./services/OpenAICompatibleClient";
import {
  WORKBENCH_VIEW_IDS,
  WORKBENCH_VIEW_METADATA,
} from "../shared/workbenchViews";
import { openGitMinSettings } from "./configuration";
import { configureLocale } from "../shared/i18n";

export function activate(context: vscode.ExtensionContext) {
  configureLocale(vscode.env.language);
  const fileDiffNavigator = new FileDiffNavigator();
  const copilotModelSelector = new CopilotModelSelector();
  const customModelCredentials = new CustomModelCredentials(context.secrets);
  const commitMessageGenerator = new CommitMessageGenerator(
    copilotModelSelector,
    new OpenAICompatibleClient(customModelCredentials),
  );
  const repositorySelection = new RepositorySelectionService(
    context.workspaceState,
    getGitApi,
    () => vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [],
  );
  const viewProvider = new GitPanelViewProvider(
    context.extensionUri,
    fileDiffNavigator,
    context.workspaceState,
    repositorySelection,
    commitMessageGenerator,
  );
  context.subscriptions.push(
    fileDiffNavigator,
    repositorySelection,
    vscode.workspace.onDidChangeWorkspaceFolders(() =>
      void repositorySelection.refresh(),
    ),
    vscode.window.registerWebviewViewProvider(
      GitPanelViewProvider.VIEW_ID,
      viewProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    vscode.commands.registerCommand("gitmin.openPanel", () => {
      GitPanelProvider.show(
        context,
        fileDiffNavigator,
        repositorySelection,
        commitMessageGenerator,
      );
    }),
    vscode.commands.registerCommand("gitmin.openSettings", openGitMinSettings),
    vscode.commands.registerCommand("gitmin.selectCommitMessageModel", () =>
      copilotModelSelector.configure(),
    ),
    vscode.commands.registerCommand("gitmin.setCustomModelApiKey", () =>
      customModelCredentials.configure(),
    ),
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
