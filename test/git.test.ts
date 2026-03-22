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
  fs.writeFileSync(path.join(cwd, 'button.tsx'), 'export const Button = () => <button className="bg-red-500" />;\n');
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{}\n');
  fs.writeFileSync(path.join(cwd, 'logo.png'), 'binary');

  execSync('git add button.tsx package-lock.json logo.png', { cwd, stdio: 'ignore' });

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
