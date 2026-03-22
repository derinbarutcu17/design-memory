import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { installHook } from '../src/cli/install';
import { ghostConfig } from '../src/cli/ghost';

function withCwd<T>(cwd: string, fn: () => Promise<T> | T) {
  const previous = process.cwd();
  process.chdir(cwd);
  return Promise.resolve(fn()).finally(() => {
    process.chdir(previous);
  });
}

function makeRepoRoot() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'design-memory-cli-'));
  fs.mkdirSync(path.join(cwd, '.git', 'hooks'), { recursive: true });
  return cwd;
}

test('installHook writes the pre-commit hook with executable permissions', async () => {
  const cwd = makeRepoRoot();
  await withCwd(cwd, async () => {
    await installHook();
  });

  const hookPath = path.join(cwd, '.git', 'hooks', 'pre-commit');
  const hookContent = fs.readFileSync(hookPath, 'utf-8');
  assert.match(hookContent, /npx @derin\/design-memory audit/);
  assert.match(hookContent, /git commit --no-verify/);
  assert.equal(fs.statSync(hookPath).mode & 0o777, 0o755);
  assert.ok(fs.existsSync(path.join(cwd, 'design-memory.config.json')));
});

test('ghostConfig creates .cursorrules when no IDE rules file exists', async () => {
  const cwd = makeRepoRoot();
  await withCwd(cwd, async () => {
    await ghostConfig();
  });

  const content = fs.readFileSync(path.join(cwd, '.cursorrules'), 'utf-8');
  assert.match(content, /MUST cross-reference the components with design\.md/);
});
