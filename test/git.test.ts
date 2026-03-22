import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { getStagedDiff } from '../src/lib/git';

function makeTempRepo() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'design-memory-git-'));
  execSync('git init', { cwd, stdio: 'ignore' });
  execSync('git config user.email "qa@example.com"', { cwd, stdio: 'ignore' });
  execSync('git config user.name "QA"', { cwd, stdio: 'ignore' });
  return cwd;
}

test('getStagedDiff includes staged UI files and filters lockfiles/media', () => {
  const cwd = makeTempRepo();
  fs.writeFileSync(
    path.join(cwd, 'design-memory.config.json'),
    JSON.stringify({
      strictness: 'warn',
      stateDir: '.design-memory',
      reference: { sourceType: 'design-md', path: './DESIGN.md' },
      include: ['**/*.tsx'],
      exclude: [],
      rules: {
        'color.raw-hex': 'error',
        'tailwind.arbitrary-spacing': 'error',
        'tailwind.arbitrary-radius': 'error',
        'tailwind.arbitrary-font-size': 'warn',
        'style.inline': 'error',
        'token.mismatch': 'error',
        'component.required-pattern': 'error',
        'component.disallowed-pattern': 'error',
        'component.variant-drift': 'warn',
        'component.missing-state': 'warn',
      },
      baseline: { mode: 'net-new-only' },
      llmFallback: { enabled: false, mode: 'explain-only' },
      ai: { providerPreference: ['local'], maxRetries: 1 },
      visualProvider: 'none',
    }),
  );
  fs.writeFileSync(path.join(cwd, 'button.tsx'), 'export const Button = () => <button className="bg-red-500" />;\n');
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{}\n');
  fs.writeFileSync(path.join(cwd, 'logo.png'), 'binary');

  execSync('git add design-memory.config.json button.tsx package-lock.json logo.png', { cwd, stdio: 'ignore' });

  const diff = getStagedDiff(cwd);
  assert.match(diff, /FILE: button\.tsx/);
  assert.doesNotMatch(diff, /package-lock\.json/);
  assert.doesNotMatch(diff, /logo\.png/);
});

test('getStagedDiff returns empty string when only ignored files are staged', () => {
  const cwd = makeTempRepo();
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{}\n');
  fs.writeFileSync(path.join(cwd, 'hero.jpg'), 'binary');
  execSync('git add package-lock.json hero.jpg', { cwd, stdio: 'ignore' });

  assert.equal(getStagedDiff(cwd), '');
});

test('getStagedDiff respects include and exclude config globs', () => {
  const cwd = makeTempRepo();
  fs.writeFileSync(
    path.join(cwd, 'design-memory.config.json'),
    JSON.stringify({
      strictness: 'warn',
      stateDir: '.design-memory',
      reference: { sourceType: 'design-md', path: './DESIGN.md' },
      include: ['src/components/**/*.tsx'],
      exclude: ['src/components/internal/**'],
      rules: {
        'color.raw-hex': 'error',
        'tailwind.arbitrary-spacing': 'error',
        'tailwind.arbitrary-radius': 'error',
        'tailwind.arbitrary-font-size': 'warn',
        'style.inline': 'error',
        'token.mismatch': 'error',
        'component.required-pattern': 'error',
        'component.disallowed-pattern': 'error',
        'component.variant-drift': 'warn',
        'component.missing-state': 'warn',
      },
      baseline: { mode: 'net-new-only' },
      llmFallback: { enabled: false, mode: 'explain-only' },
      ai: { providerPreference: ['local'], maxRetries: 1 },
      visualProvider: 'none',
    }),
  );
  fs.mkdirSync(path.join(cwd, 'src', 'components', 'internal'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'src', 'components', 'Button.tsx'), 'export const Button = () => <button />;\n');
  fs.writeFileSync(path.join(cwd, 'src', 'components', 'internal', 'Secret.tsx'), 'export const Secret = () => <div />;\n');
  execSync('git add design-memory.config.json src/components/Button.tsx src/components/internal/Secret.tsx', { cwd, stdio: 'ignore' });

  const diff = getStagedDiff(cwd);
  assert.match(diff, /FILE: src\/components\/Button\.tsx/);
  assert.doesNotMatch(diff, /Secret\.tsx/);
});
