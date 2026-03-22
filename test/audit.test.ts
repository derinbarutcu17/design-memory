import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAuditPrompt, findDeterministicViolations, parseAuditResult, runAudit } from '../src/lib/audit';

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
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'design-memory-audit-block-'));
  fs.writeFileSync(
    path.join(cwd, 'design-memory.config.json'),
    JSON.stringify({
      strictness: 'block',
      designSource: './DESIGN.md',
      include: [],
      exclude: [],
      ai: { providerPreference: ['local'], maxRetries: 1 },
    }),
  );

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
  }, { cwd });

  assert.equal(exitCode, 1);
});

test('findDeterministicViolations flags raw hex values missing from design context', () => {
  const violations = findDeterministicViolations(
    'FILE: button.tsx\n+ className="bg-[#ff0000] text-white"\n',
    'Approved tokens: #00ff00',
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0].issue, /#ff0000/i);
});

test('runAudit warns instead of blocking when strictness is warn', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'design-memory-audit-'));
  fs.writeFileSync(
    path.join(cwd, 'design-memory.config.json'),
    JSON.stringify({
      strictness: 'warn',
      designSource: './DESIGN.md',
      include: [],
      exclude: [],
      ai: { providerPreference: ['local'], maxRetries: 1 },
    }),
  );

  let exitCode: number | undefined;
  await runAudit({
    getDiff: () => 'FILE: button.tsx\n+ className="bg-[#ff0000]"',
    getContext: async () => 'Use #00ff00 only.',
    getBrain: async () => ({ provider: 'openai', apiKey: 'key', model: 'gpt-4o' }),
    askBrain: async () => '{"driftDetected":false,"violations":[]}',
    exit: ((code?: number) => {
      exitCode = code;
      return undefined as never;
    }) as typeof process.exit,
  }, { cwd });

  assert.equal(exitCode, 0);
});
