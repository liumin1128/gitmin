import type { CustomModelSettings } from '../configuration';
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
    if (!settings.baseUrl) throw new Error('Custom model Base URL is required');
    if (!settings.model) throw new Error('Custom model ID is required');

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
        throw new Error('Custom model request timed out');
      }
      throw new Error(`Custom model request failed: ${errorMessage(error)}`);
    }

    if (!response.ok) {
      const details = (await response.text()).trim().replace(/\s+/g, ' ').slice(0, 300);
      throw new Error(
        `Custom model request failed (${response.status})${details ? `: ${details}` : ''}`
      );
    }

    return readChatCompletionMessage(await response.json());
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
