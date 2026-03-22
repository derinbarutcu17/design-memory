import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAuditPrompt, parseAuditResult, runAudit } from '../src/lib/audit';

test('buildAuditPrompt contains strict JSON contract', () => {
  const prompt = buildAuditPrompt('context', 'diff');
  assert.match(prompt.systemPrompt, /"driftDetected": boolean/);
  assert.match(prompt.systemPrompt, /"violations":/);
  assert.match(prompt.userPrompt, /DESIGN CONTEXT:/);
  assert.match(prompt.userPrompt, /GIT DIFF:/);
});

test('parseAuditResult rejects invalid JSON payloads', () => {
  assert.throws(() => parseAuditResult('{"violations":[]}'), /missing driftDetected boolean/);
});

test('runAudit exits 0 when no staged UI changes are present', async () => {
  let exitCode: number | undefined;
  await runAudit({
    getDiff: () => '',
    exit: ((code?: number) => {
      exitCode = code;
      return undefined as never;
    }) as typeof process.exit,
  });

  assert.equal(exitCode, 0);
});

test('runAudit exits 1 and reports violations when drift is detected', async () => {
  let exitCode: number | undefined;
  await runAudit({
    getDiff: () => 'FILE: button.tsx\n+ bg-red-500',
    getContext: async () => 'Use neutral tokens.',
    getBrain: async () => ({ provider: 'openai', apiKey: 'key', model: 'gpt-4o' }),
    askBrain: async () => '{"driftDetected":true,"violations":[{"file":"button.tsx","issue":"Hardcoded red token."}]}',
    exit: ((code?: number) => {
      exitCode = code;
      return undefined as never;
    }) as typeof process.exit,
  });

  assert.equal(exitCode, 1);
});
