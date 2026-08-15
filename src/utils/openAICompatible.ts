import { t } from '../../shared/i18n';

export interface ChatCompletionPayload {
  model: string;
  messages: Array<{ role: 'user'; content: string }>;
  max_tokens: number;
}

// Reasoning-capable models may use part of the completion budget before emitting text.
export const COMMIT_MESSAGE_MAX_TOKENS = 4_096;

export function buildChatCompletionsUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    throw new Error(t('error.customBaseUrlInvalid'));
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(t('error.customBaseUrlInvalid'));
  }

  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/chat/completions')
    ? path
    : `${path}/chat/completions`;
  url.hash = '';
  return url.toString();
}

export function createChatCompletionPayload(
  model: string,
  prompt: string
): ChatCompletionPayload {
  return {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: COMMIT_MESSAGE_MAX_TOKENS,
  };
}

export function readChatCompletionMessage(response: unknown): string {
  const choice = (
    response as {
      choices?: Array<{
        finish_reason?: unknown;
        message?: { content?: unknown };
      }>;
    }
  )?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    if (choice?.finish_reason === 'length') {
      throw new Error(t('error.customTokenBudget'));
    }
    throw new Error(t('error.customEmptyResponse'));
  }
  return content.trim();
}
