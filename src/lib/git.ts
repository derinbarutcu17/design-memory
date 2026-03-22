import { execFileSync } from 'node:child_process';
import { readConfig, shouldAuditFile } from './config';

const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot'];
const IGNORED_FILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

type ExecFileSyncLike = typeof execFileSync;

function git(args: string[], cwd = process.cwd(), exec: ExecFileSyncLike = execFileSync) {
  return exec('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

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
  exec: ExecFileSyncLike = execFileSync,
) {
  return git(['show', `:${filePath}`], cwd, exec);
}

export function getStagedDiff(
  cwd = process.cwd(),
  exec: ExecFileSyncLike = execFileSync,
): string {
  const stagedFiles = git(['diff', '--cached', '--name-only'], cwd, exec)
    .split('\n')
    .map((file) => file.trim())
    .filter((file) => file.length > 0);

  const filteredFiles = filterAuditableFiles(stagedFiles, cwd);
  if (filteredFiles.length === 0) {
    return '';
  }

  let diffContent = '';
  for (const file of filteredFiles) {
    const diff = git(['diff', '--cached', '--', file], cwd, exec);
    diffContent += `FILE: ${file}\n${diff}\n\n`;
  }

  return diffContent.trim();
}
