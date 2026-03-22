import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { detectAvailableBrain, promptBrain } from '../src/lib/engine';
import { makeTempDir, writeConfig } from './helpers';

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
  const cwd = makeTempDir('design-memory-engine-');
  writeConfig(cwd, {
    strictness: 'warn',
    include: [],
    exclude: [],
    ai: { providerPreference: ['openai', 'anthropic'] },
  });

  const previous = process.cwd();
  const oldOpenAI = process.env.OPENAI_API_KEY;
  const oldAnthropic = process.env.ANTHROPIC_API_KEY;
  process.chdir(cwd);
  process.env.OPENAI_API_KEY = 'openai-key';
  process.env.ANTHROPIC_API_KEY = 'anthropic-key';

  try {
    const brain = await detectAvailableBrain((async () => new Response('no', { status: 500 })) as typeof fetch, cwd);
    assert.equal(brain?.provider, 'openai');
  } finally {
    process.chdir(previous);
    process.env.OPENAI_API_KEY = oldOpenAI;
    process.env.ANTHROPIC_API_KEY = oldAnthropic;
  }
});

test('detectAvailableBrain uses the provided cwd instead of ambient process cwd', async () => {
  const workspace = makeTempDir('design-memory-engine-cwd-');
  const targetCwd = path.join(workspace, 'target');
  const ambientCwd = path.join(workspace, 'ambient');
  fs.mkdirSync(targetCwd, { recursive: true });
  fs.mkdirSync(ambientCwd, { recursive: true });

  writeConfig(targetCwd, {
    strictness: 'warn',
    include: [],
    exclude: [],
    ai: { providerPreference: ['anthropic', 'openai'] },
  });

  writeConfig(ambientCwd, {
    strictness: 'warn',
    include: [],
    exclude: [],
    ai: { providerPreference: ['openai', 'anthropic'] },
  });

  const previous = process.cwd();
  const oldOpenAI = process.env.OPENAI_API_KEY;
  const oldAnthropic = process.env.ANTHROPIC_API_KEY;
  process.chdir(ambientCwd);
  process.env.OPENAI_API_KEY = 'openai-key';
  process.env.ANTHROPIC_API_KEY = 'anthropic-key';

  try {
    const brain = await detectAvailableBrain((async () => new Response('no', { status: 500 })) as typeof fetch, targetCwd);
    assert.equal(brain?.provider, 'anthropic');
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
