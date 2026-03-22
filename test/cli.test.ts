import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { makeRepoRoot } from './helpers';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('cli init supports --cwd', () => {
  const cwd = makeRepoRoot();
  execFileSync('node', ['dist/cli/index.js', 'init', '--cwd', cwd], {
    cwd: repoRoot,
    stdio: 'ignore',
  });

  assert.ok(fs.existsSync(path.join(cwd, 'design-memory.config.json')));
  assert.ok(fs.existsSync(path.join(cwd, '.design-memory')));
});

test('cli compare supports --cwd', () => {
  const cwd = makeRepoRoot();
  fs.mkdirSync(path.join(cwd, '.design-memory'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.design-memory', 'latest-run.json'),
    JSON.stringify({
      id: 'run_test',
      status: 'completed',
      summary: {
        totalIssues: 0,
        error: 0,
        warn: 0,
        byType: {},
        byStatus: {},
      },
      filesAnalyzed: [],
      matchedComponents: [],
      issues: [],
      comparison: {
        resolvedFingerprints: [],
        remainingFingerprints: [],
        newFingerprints: [],
        reopenedFingerprints: [],
      },
      createdAt: new Date().toISOString(),
    }),
  );

  const output = execFileSync('node', ['dist/cli/index.js', 'compare', '--cwd', cwd, '--json'], {
    cwd: repoRoot,
    encoding: 'utf-8',
  });

  assert.match(output, /resolvedFingerprints/);
});
