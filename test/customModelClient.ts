import assert from 'node:assert/strict';
import { OpenAICompatibleClient } from '../src/services/OpenAICompatibleClient';

async function main() {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const client = new OpenAICompatibleClient(
    { requireApiKey: async () => 'secret-key' },
    async (input, init) => {
      requestUrl = input;
      requestInit = init;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'feat: custom provider' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  );

  assert.equal(
    await client.generate('prompt', {
      enabled: true,
      baseUrl: 'https://models.example.test/v1',
      model: 'custom-model',
    }),
    'feat: custom provider'
  );
  assert.equal(requestUrl, 'https://models.example.test/v1/chat/completions');
  assert.equal((requestInit?.headers as Record<string, string>).Authorization, 'Bearer secret-key');
  const requestBody = JSON.parse(String(requestInit?.body));
  assert.equal(requestBody.model, 'custom-model');
  assert.equal(requestBody.max_tokens, 1_024);

  await assert.rejects(
    () => client.generate('prompt', { enabled: true, baseUrl: '', model: 'custom-model' }),
    /Base URL is required/
  );
  const rejectedClient = new OpenAICompatibleClient(
    { requireApiKey: async () => 'invalid-key' },
    async () => new Response('invalid credentials', { status: 401 })
  );
  await assert.rejects(
    () =>
      rejectedClient.generate('prompt', {
        enabled: true,
        baseUrl: 'https://models.example.test/v1',
        model: 'custom-model',
      }),
    /failed \(401\): invalid credentials/
  );

  console.log('custom model client checks passed');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
