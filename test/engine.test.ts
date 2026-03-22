import test from 'node:test';
import assert from 'node:assert/strict';

import { detectAvailableBrain, promptBrain } from '../src/lib/engine';

test('detectAvailableBrain prefers local providers before API keys', async () => {
  const oldOpenAI = process.env.OPENAI_API_KEY;
  const oldAnthropic = process.env.ANTHROPIC_API_KEY;
  process.env.OPENAI_API_KEY = 'openai-key';
  process.env.ANTHROPIC_API_KEY = 'anthropic-key';

  const fakeFetch = async (url: string | URL | Request): Promise<Response> => {
    const href = String(url);
    if (href.includes('11434')) {
      return new Response('{}', { status: 200 });
    }
    return new Response('no', { status: 500 });
  };

  const brain = await detectAvailableBrain(fakeFetch as typeof fetch);
  assert.deepEqual(brain, {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/api/generate',
    model: 'llama3',
  });

  process.env.OPENAI_API_KEY = oldOpenAI;
  process.env.ANTHROPIC_API_KEY = oldAnthropic;
});

test('promptBrain throws on non-ok provider responses', async () => {
  await assert.rejects(
    promptBrain(
      { provider: 'openai', apiKey: 'key', model: 'gpt-4o' },
      'sys',
      'user',
      (async () => new Response('bad request', { status: 400 })) as typeof fetch,
    ),
    /Brain request failed \(400\): bad request/,
  );
});
