import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { installHook } from '../src/cli/install';
import { ghostConfig } from '../src/cli/ghost';
import { makeRepoRoot, makeTempDir } from './helpers';

test('installHook writes the pre-commit hook with executable permissions', async () => {
  const cwd = makeRepoRoot();
  const ambientCwd = makeTempDir('design-memory-ambient-');
  const previous = process.cwd();
  process.chdir(ambientCwd);
  try {
    await installHook(cwd);
  } finally {
    process.chdir(previous);
  }

  const hookPath = path.join(cwd, '.git', 'hooks', 'pre-commit');
  const hookContent = fs.readFileSync(hookPath, 'utf-8');
  assert.match(hookContent, /design-memory audit/);
  assert.match(hookContent, /git commit --no-verify/);
  assert.equal(fs.statSync(hookPath).mode & 0o777, 0o755);
  assert.ok(fs.existsSync(path.join(cwd, 'design-memory.config.json')));
  assert.ok(fs.existsSync(path.join(cwd, '.design-memory')));
});

test('ghostConfig creates .cursorrules when no IDE rules file exists', async () => {
  const cwd = makeRepoRoot();
  const ambientCwd = makeTempDir('design-memory-ambient-');
  const previous = process.cwd();
  process.chdir(ambientCwd);
  try {
    await ghostConfig(cwd);
  } finally {
    process.chdir(previous);
  }

  const content = fs.readFileSync(path.join(cwd, '.cursorrules'), 'utf-8');
  assert.match(content, /DESIGN MEMORY RULE/);
});
