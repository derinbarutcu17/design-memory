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

test('detectAvailableBrain respects config provider preference ordering', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'design-memory-engine-'));
  fs.writeFileSync(
    path.join(cwd, 'design-memory.config.json'),
    JSON.stringify({
      strictness: 'warn',
      designSource: './DESIGN.md',
      include: [],
      exclude: [],
      ai: { providerPreference: ['openai', 'anthropic'], maxRetries: 1 },
    }),
  );

  const previous = process.cwd();
  const oldOpenAI = process.env.OPENAI_API_KEY;
  const oldAnthropic = process.env.ANTHROPIC_API_KEY;
  process.chdir(cwd);
  process.env.OPENAI_API_KEY = 'openai-key';
  process.env.ANTHROPIC_API_KEY = 'anthropic-key';

  try {
    const brain = await detectAvailableBrain((async () => new Response('no', { status: 500 })) as typeof fetch);
    assert.equal(brain?.provider, 'openai');
  } finally {
    process.chdir(previous);
    process.env.OPENAI_API_KEY = oldOpenAI;
    process.env.ANTHROPIC_API_KEY = oldAnthropic;
  }
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
