import fs from 'fs';
import path from 'path';
import { writeDefaultConfig } from '../lib/config';
import { ensureState } from '../lib/state';

export async function installHook(cwd = process.cwd()) {
  const gitDir = path.join(cwd, '.git');
  const hooksDir = path.join(gitDir, 'hooks');

  if (!fs.existsSync(gitDir)) {
    throw new Error('No .git directory found. Run this from your repository root.');
  }

  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = path.join(hooksDir, 'pre-commit');
  const hookContent = `#!/bin/sh
echo "[Design Memory] Auditing staged files for design drift..."
design-memory audit
if [ $? -ne 0 ]; then
  echo "[Design Memory] ⚠️ Commit blocked. If this is a false positive, force the commit by running: git commit --no-verify"
  exit 1
fi
`;
  const configPath = writeDefaultConfig(cwd);
  const statePaths = ensureState(cwd);

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');
    if (existing.includes('design-memory audit')) {
      console.log('[Design Memory] Pre-commit hook already installed.');
      return;
    }
    fs.appendFileSync(hookPath, '\n' + hookContent.replace('#!/bin/sh\n', ''));
    console.log('[Design Memory] Appended audit command to existing pre-commit hook.');
  } else {
    fs.writeFileSync(hookPath, hookContent, { encoding: 'utf-8', mode: 0o755 });
    console.log('[Design Memory] Created pre-commit hook.');
  }

  fs.chmodSync(hookPath, '755');
  console.log(`[Design Memory] Config ready at ${configPath}.`);
  console.log(`[Design Memory] State directory ready at ${statePaths.root}.`);
}
