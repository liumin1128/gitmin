import * as vscode from 'vscode';
import type { CommitMessageLanguage } from '../../shared/workingTree';
import {
  getCommitMessagePrompt,
  getCustomModelSettings,
} from '../configuration';
import {
  buildCommitMessagePrompt,
  normalizeGeneratedCommitMessage,
} from '../utils/commitMessage';
import { CopilotModelSelector } from './CopilotModelSelector';
import { OpenAICompatibleClient } from './OpenAICompatibleClient';

export interface GeneratedCommitMessage {
  message: string;
  model: string;
}

const CUSTOM_MODEL_MAX_DIFF_CHARS = 24_000;

export class CommitMessageGenerator {
  constructor(
    private readonly modelSelector: CopilotModelSelector,
    private readonly customModelClient: OpenAICompatibleClient
  ) {}

  async generate(
    diff: string,
    language: CommitMessageLanguage
  ): Promise<GeneratedCommitMessage | null> {
    const customPrompt = getCommitMessagePrompt();
    const customModel = getCustomModelSettings();
    if (customModel.enabled) {
      const prompt = buildCommitMessagePrompt(
        diff,
        language,
        CUSTOM_MODEL_MAX_DIFF_CHARS,
        customPrompt,
      );
      const output = await this.customModelClient.generate(prompt, customModel);
      return {
        message: normalizeGeneratedCommitMessage(output),
        model: customModel.model,
      };
    }

    const model = await this.modelSelector.selectForGeneration();
    if (!model) return null;

    const cancellation = new vscode.CancellationTokenSource();
    try {
      const prompt = await this.fitPrompt(
        diff,
        language,
        customPrompt,
        model,
        cancellation.token
      );
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

  private async fitPrompt(
    diff: string,
    language: CommitMessageLanguage,
    customPrompt: string,
    model: vscode.LanguageModelChat,
    token: vscode.CancellationToken
  ): Promise<string> {
    let diffLimit = Math.min(diff.trim().length, 120_000);
    const tokenBudget = Math.max(128, Math.floor(model.maxInputTokens * 0.85));

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const prompt = buildCommitMessagePrompt(diff, language, diffLimit, customPrompt);
      const tokenCount = await model.countTokens(
        vscode.LanguageModelChatMessage.User(prompt),
        token
      );
      if (tokenCount <= tokenBudget) return prompt;

      const nextLimit = Math.floor(diffLimit * (tokenBudget / tokenCount) * 0.9);
      diffLimit = Math.max(256, Math.min(diffLimit - 1, nextLimit));
    }

    const prompt = buildCommitMessagePrompt(diff, language, diffLimit, customPrompt);
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
