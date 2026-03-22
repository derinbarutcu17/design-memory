import { execSync } from 'child_process';
import { readConfig, shouldAuditFile } from './config';

const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot'];
const IGNORED_FILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

export function isAuditableCodeFile(file: string) {
  const isLockfile = IGNORED_FILES.some((ignored) => file.endsWith(ignored));
  const hasIgnoredExtension = IGNORED_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext));
  const isCodeFile = /\.(tsx?|jsx?|css|html)$/.test(file);
  return !isLockfile && !hasIgnoredExtension && isCodeFile;
}

export function filterAuditableFiles(filePaths: string[], cwd = process.cwd()) {
  const config = readConfig(cwd);
  return filePaths.filter((file) => isAuditableCodeFile(file) && shouldAuditFile(file, config));
}

export function getStagedFileContent(
  filePath: string,
  cwd = process.cwd(),
  exec: typeof execSync = execSync,
) {
  try {
    return exec(`git show ":${filePath}"`, { encoding: 'utf-8', cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return null;
  }
}

export function getStagedDiff(
  cwd = process.cwd(),
  exec: typeof execSync = execSync,
): string {
  try {
    const stagedFiles = exec('git diff --cached --name-only', { encoding: 'utf-8', cwd })
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    const filteredFiles = filterAuditableFiles(stagedFiles, cwd);

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
