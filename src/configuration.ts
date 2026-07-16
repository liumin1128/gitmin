import * as vscode from 'vscode';
import type { CommitMessageLanguage } from '../shared/workingTree';

const CONFIGURATION_SECTION = 'gitmin';
const COMMIT_MESSAGE_LANGUAGE = 'commitMessageLanguage';

export function getCommitMessageLanguage(): CommitMessageLanguage {
  const language = vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION)
    .get<string>(COMMIT_MESSAGE_LANGUAGE, 'en');
  return language === 'zh' ? 'zh' : 'en';
}

export function openGitMinSettings(): Thenable<unknown> {
  return vscode.commands.executeCommand(
    'workbench.action.openSettings',
    '@ext:liumin.gitmin'
  );
}
