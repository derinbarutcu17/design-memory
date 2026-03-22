import { execSync } from 'child_process';

const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot'];
const IGNORED_FILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

export function getStagedDiff(
  cwd = process.cwd(),
  exec: typeof execSync = execSync,
): string {
  try {
    const stagedFiles = exec('git diff --cached --name-only', { encoding: 'utf-8', cwd })
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    const filteredFiles = stagedFiles.filter(file => {
      const isLockfile = IGNORED_FILES.some(ignored => file.endsWith(ignored));
      const hasIgnoredExtension = IGNORED_EXTENSIONS.some(ext => file.toLowerCase().endsWith(ext));
      const isCodeFile = /\.(tsx?|jsx?|css|html)$/.test(file);
      return !isLockfile && !hasIgnoredExtension && isCodeFile;
    });

    if (filteredFiles.length === 0) {
      return '';
    }

    let diffContent = '';
    for (const file of filteredFiles) {
      const diff = exec(`git diff --cached "${file}"`, { encoding: 'utf-8', cwd });
      diffContent += `FILE: ${file}\n${diff}\n\n`;
    }

    return diffContent.trim();
  } catch (error) {
    console.error('Error fetching staged diff:', error);
    return '';
  }
}
