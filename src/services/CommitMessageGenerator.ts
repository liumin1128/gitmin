import * as vscode from 'vscode';
import {
  buildCommitMessagePrompt,
  normalizeGeneratedCommitMessage,
} from '../utils/commitMessage';

interface ModelQuickPickItem extends vscode.QuickPickItem {
  model: vscode.LanguageModelChat;
}

export interface GeneratedCommitMessage {
  message: string;
  model: string;
}

export class CommitMessageGenerator {
  async generate(diff: string): Promise<GeneratedCommitMessage | null> {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    if (models.length === 0) {
      throw new Error(
        'No Copilot model is available. Sign in to GitHub Copilot and enable a chat model.'
      );
    }

    const model = await this.selectModel(models);
    if (!model) return null;

    const cancellation = new vscode.CancellationTokenSource();
    try {
      const prompt = await this.fitPrompt(diff, model, cancellation.token);
      const response = await model.sendRequest(
        [vscode.LanguageModelChatMessage.User(prompt)],
        { justification: 'Generate a Git commit message from the staged diff.' },
        cancellation.token
      );
      let output = '';
      for await (const chunk of response.text) {
        output += chunk;
        if (output.length >= 4_096) break;
      }
      return {
        message: normalizeGeneratedCommitMessage(output),
        model: model.name,
      };
    } catch (error) {
      throw readableLanguageModelError(error);
    } finally {
      cancellation.dispose();
    }
  }

  private async selectModel(
    models: readonly vscode.LanguageModelChat[]
  ): Promise<vscode.LanguageModelChat | undefined> {
    if (models.length === 1) return models[0];

    const items: ModelQuickPickItem[] = models.map((model) => ({
      label: model.name,
      description: model.family,
      detail: `Copilot - ${model.id}`,
      model,
    }));
    const selected = await vscode.window.showQuickPick(items, {
      title: 'Generate Commit Message',
      placeHolder: 'Select a Copilot model',
    });
    return selected?.model;
  }

  private async fitPrompt(
    diff: string,
    model: vscode.LanguageModelChat,
    token: vscode.CancellationToken
  ): Promise<string> {
    let diffLimit = Math.min(diff.trim().length, 120_000);
    const tokenBudget = Math.max(128, Math.floor(model.maxInputTokens * 0.85));

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const prompt = buildCommitMessagePrompt(diff, diffLimit);
      const tokenCount = await model.countTokens(
        vscode.LanguageModelChatMessage.User(prompt),
        token
      );
      if (tokenCount <= tokenBudget) return prompt;

      const nextLimit = Math.floor(diffLimit * (tokenBudget / tokenCount) * 0.9);
      diffLimit = Math.max(256, Math.min(diffLimit - 1, nextLimit));
    }

    const prompt = buildCommitMessagePrompt(diff, diffLimit);
    const tokenCount = await model.countTokens(
      vscode.LanguageModelChatMessage.User(prompt),
      token
    );
    if (tokenCount > tokenBudget) {
      throw new Error('The staged diff is too large for the selected Copilot model');
    }
    return prompt;
  }
}

function readableLanguageModelError(error: unknown): Error {
  if (!(error instanceof vscode.LanguageModelError)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  if (error.code === 'NoPermissions') {
    return new Error('Copilot model access was not granted');
  }
  if (error.code === 'Blocked') {
    return new Error('The Copilot request was blocked or its quota was exceeded');
  }
  if (error.code === 'NotFound') {
    return new Error('The selected Copilot model is no longer available');
  }
  return new Error(error.message || 'Copilot could not generate a commit message');
}
