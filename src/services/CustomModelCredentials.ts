import * as vscode from 'vscode';
import { t } from '../../shared/i18n';

const CUSTOM_MODEL_API_KEY = 'gitmin.customModel.apiKey';

export class CustomModelCredentials {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async requireApiKey(): Promise<string> {
    const stored = (await this.secrets.get(CUSTOM_MODEL_API_KEY))?.trim();
    if (stored) return stored;

    const entered = await this.promptAndStore();
    if (!entered) throw new Error(t('credentials.required'));
    return entered;
  }

  async configure(): Promise<void> {
    const apiKey = await this.promptAndStore();
    if (apiKey) {
      void vscode.window.showInformationMessage(t('credentials.saved'));
    }
  }

  private async promptAndStore(): Promise<string | undefined> {
    const value = await vscode.window.showInputBox({
      title: t('credentials.title'),
      prompt: t('credentials.prompt'),
      placeHolder: t('credentials.placeholder'),
      password: true,
      ignoreFocusOut: true,
      validateInput: (input) => (input.trim() ? undefined : t('credentials.validation')),
    });
    if (value === undefined) return undefined;

    const apiKey = value.trim();
    await this.secrets.store(CUSTOM_MODEL_API_KEY, apiKey);
    return apiKey;
  }
}
