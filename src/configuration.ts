import * as vscode from 'vscode';
import type { CommitMessageLanguage } from '../shared/workingTree';

const CONFIGURATION_SECTION = 'gitmin';
const COMMIT_MESSAGE_LANGUAGE = 'commitMessageLanguage';
const COMMIT_MESSAGE_MODEL = 'commitMessageModel';
const COMMIT_MESSAGE_PROMPT = 'commitMessagePrompt';
const CUSTOM_MODEL_ENABLED = 'customModel.enabled';
const CUSTOM_MODEL_BASE_URL = 'customModel.baseUrl';
const CUSTOM_MODEL_ID = 'customModel.model';

export interface CustomModelSettings {
  enabled: boolean;
  baseUrl: string;
  model: string;
}

export function getCommitMessageLanguage(): CommitMessageLanguage {
  const language = vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION)
    .get<string>(COMMIT_MESSAGE_LANGUAGE, 'en');
  return language === 'zh' ? 'zh' : 'en';
}

export function getCommitMessageModelId(): string {
  return vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION)
    .get<string>(COMMIT_MESSAGE_MODEL, '')
    .trim();
}

export function setCommitMessageModelId(modelId: string): Thenable<void> {
  const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
  const inspection = configuration.inspect<string>(COMMIT_MESSAGE_MODEL);
  const target =
    inspection?.workspaceValue === undefined
      ? vscode.ConfigurationTarget.Global
      : vscode.ConfigurationTarget.Workspace;
  return configuration.update(COMMIT_MESSAGE_MODEL, modelId, target);
}

export function getCommitMessagePrompt(): string {
  return vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION)
    .get<string>(COMMIT_MESSAGE_PROMPT, '')
    .trim();
}

export function getCustomModelSettings(): CustomModelSettings {
  const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
  return {
    enabled: configuration.get<boolean>(CUSTOM_MODEL_ENABLED, false),
    baseUrl: configuration.get<string>(CUSTOM_MODEL_BASE_URL, '').trim(),
    model: configuration.get<string>(CUSTOM_MODEL_ID, '').trim(),
  };
}

export function openGitMinSettings(): Thenable<unknown> {
  return vscode.commands.executeCommand(
    'workbench.action.openSettings',
    '@ext:liumin.gitmin'
  );
}
