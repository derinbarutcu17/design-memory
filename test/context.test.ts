import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getDesignContext } from '../src/lib/context';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'design-memory-context-'));
}

test('getDesignContext reads DESIGN.md and .cursorrules from cwd', async () => {
  const cwd = makeTempDir();
  fs.writeFileSync(path.join(cwd, 'DESIGN.md'), '# Spec\nUse spacing tokens.');
  fs.writeFileSync(path.join(cwd, '.cursorrules'), 'Always read design.md first.');

  const context = await getDesignContext({ cwd });
  assert.match(context, /DESIGN SPECIFICATION/);
  assert.match(context, /Use spacing tokens/);
  assert.match(context, /PROJECT RULES/);
  assert.match(context, /Always read design\.md first/);
});

test('getDesignContext tolerates malformed config files', async () => {
  const cwd = makeTempDir();
  fs.writeFileSync(path.join(cwd, 'design-memory.json'), '{invalid json');

  const context = await getDesignContext({ cwd });
  assert.equal(context, '');
});

test('getDesignContext respects design-memory.config.json designSource', async () => {
  const cwd = makeTempDir();
  fs.writeFileSync(path.join(cwd, 'spec.md'), '# Alternate spec\nUse engraved inputs.');
  fs.writeFileSync(
    path.join(cwd, 'design-memory.config.json'),
    JSON.stringify({
      strictness: 'warn',
      designSource: './spec.md',
      include: [],
      exclude: [],
      ai: { providerPreference: ['local'], maxRetries: 1 },
    }),
  );

  const context = await getDesignContext({ cwd });
  assert.match(context, /Alternate spec/);
});
