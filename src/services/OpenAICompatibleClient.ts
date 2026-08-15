import type { CustomModelSettings } from '../configuration';
import { t } from '../../shared/i18n';
import {
  buildChatCompletionsUrl,
  createChatCompletionPayload,
  readChatCompletionMessage,
} from '../utils/openAICompatible';

const REQUEST_TIMEOUT_MS = 60_000;

export interface ApiKeyProvider {
  requireApiKey(): Promise<string>;
}

export type HttpRequest = (input: string, init: RequestInit) => Promise<Response>;

export class OpenAICompatibleClient {
  private readonly credentials: ApiKeyProvider;
  private readonly request: HttpRequest;

  constructor(credentials: ApiKeyProvider, request: HttpRequest = fetch) {
    this.credentials = credentials;
    this.request = request;
  }

  async generate(prompt: string, settings: CustomModelSettings): Promise<string> {
    if (!settings.baseUrl) throw new Error(t('error.customBaseUrlRequired'));
    if (!settings.model) throw new Error(t('error.customModelRequired'));

    const apiKey = await this.credentials.requireApiKey();
    const endpoint = buildChatCompletionsUrl(settings.baseUrl);
    let response: Response;
    try {
      response = await this.request(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createChatCompletionPayload(settings.model, prompt)),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new Error(t('error.customRequestTimeout'));
      }
      throw new Error(t('error.customRequestFailed', { message: errorMessage(error) }));
    }

    if (!response.ok) {
      const details = (await response.text()).trim().replace(/\s+/g, ' ').slice(0, 300);
      throw new Error(t('error.customRequestStatus', {
        status: response.status,
        details: details ? `: ${details}` : '',
      }));
    }

    return readChatCompletionMessage(await response.json());
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
