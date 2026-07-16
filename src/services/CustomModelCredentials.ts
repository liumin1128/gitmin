import * as vscode from 'vscode';

const CUSTOM_MODEL_API_KEY = 'gitmin.customModel.apiKey';

export class CustomModelCredentials {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async requireApiKey(): Promise<string> {
    const stored = (await this.secrets.get(CUSTOM_MODEL_API_KEY))?.trim();
    if (stored) return stored;

    const entered = await this.promptAndStore();
    if (!entered) throw new Error('Custom model API key is required');
    return entered;
  }

  async configure(): Promise<void> {
    const apiKey = await this.promptAndStore();
    if (apiKey) {
      void vscode.window.showInformationMessage('GitMin custom model API key saved securely.');
    }
  }

  private async promptAndStore(): Promise<string | undefined> {
    const value = await vscode.window.showInputBox({
      title: 'Custom Model API Key',
      prompt: 'Enter the API key for the configured OpenAI-compatible endpoint.',
      placeHolder: 'API key',
      password: true,
      ignoreFocusOut: true,
      validateInput: (input) => (input.trim() ? undefined : 'API key is required'),
    });
    if (value === undefined) return undefined;

    const apiKey = value.trim();
    await this.secrets.store(CUSTOM_MODEL_API_KEY, apiKey);
    return apiKey;
  }
}
