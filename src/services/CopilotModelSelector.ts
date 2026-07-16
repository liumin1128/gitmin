import * as vscode from 'vscode';
import {
  getCommitMessageModelId,
  setCommitMessageModelId,
} from '../configuration';
import { findModelById } from '../utils/copilotModel';

interface ModelQuickPickItem extends vscode.QuickPickItem {
  model: vscode.LanguageModelChat;
}

export class CopilotModelSelector {
  async selectForGeneration(): Promise<vscode.LanguageModelChat | undefined> {
    const models = await this.getAvailableModels();
    const configuredId = getCommitMessageModelId();
    const configuredModel = findModelById(models, configuredId);
    if (configuredModel) return configuredModel;

    const [onlyModel] = models;
    if (onlyModel && models.length === 1) {
      await setCommitMessageModelId(onlyModel.id);
      return onlyModel;
    }

    return this.pickAndRemember(
      models,
      configuredId
        ? 'The saved model is unavailable. Select another Copilot model.'
        : 'Select a Copilot model'
    );
  }

  async configure(): Promise<void> {
    try {
      const models = await this.getAvailableModels();
      const selected = await this.pickAndRemember(
        models,
        'Select the Copilot model used for commit messages'
      );
      if (selected) {
        void vscode.window.showInformationMessage(
          `GitMin will use ${selected.name} for commit messages.`
        );
      }
    } catch (error) {
      void vscode.window.showErrorMessage(errorMessage(error));
    }
  }

  private async getAvailableModels(): Promise<vscode.LanguageModelChat[]> {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    if (models.length === 0) {
      throw new Error(
        'No Copilot model is available. Sign in to GitHub Copilot and enable a chat model.'
      );
    }
    return models;
  }

  private async pickAndRemember(
    models: readonly vscode.LanguageModelChat[],
    placeHolder: string
  ): Promise<vscode.LanguageModelChat | undefined> {
    const configuredId = getCommitMessageModelId();
    const items: ModelQuickPickItem[] = models.map((model) => ({
      label: model.name,
      description:
        model.id === configuredId ? `${model.family} - Current` : model.family,
      detail: `Copilot - ${model.id}`,
      model,
    }));
    const selected = await vscode.window.showQuickPick(items, {
      title: 'Select Commit Message Model',
      placeHolder,
    });
    if (!selected) return undefined;

    await setCommitMessageModelId(selected.model.id);
    return selected.model;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
