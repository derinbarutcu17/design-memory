import { execFileSync } from 'node:child_process';

export type PullRequestScan = {
  title: string;
  url: string;
  diff: string;
  files: Array<{
    path: string;
    content: string | null;
  }>;
};

function toFileScopedDiff(diff: string) {
  const chunks = diff.split(/^diff --git /m).filter(Boolean);
  const files: string[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const header = lines[0] ?? '';
    const match = header.match(/a\/(.+?)\s+b\/(.+)$/);
    const filePath = match?.[2] ?? match?.[1];
    if (!filePath) {
      continue;
    }
    files.push(`FILE: ${filePath}\n${chunk.trim()}`);
  }

  return files.join('\n\n').trim();
}

function parseFilePaths(diff: string) {
  return diff
    .split(/^FILE:\s+/m)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => block.split('\n')[0]?.trim())
    .filter((value): value is string => Boolean(value));
}

function encodeGitHubContentPath(filePath: string) {
  return filePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function gh(args: string[], cwd = process.cwd()) {
  return execFileSync('gh', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function inferGitHubRepo(cwd = process.cwd()) {
  const repo = gh(['repo', 'view', '--json', 'owner,name', '--jq', '.owner.login + "/" + .name'], cwd).trim();
  if (!repo.includes('/')) {
    throw new Error('Could not infer GitHub repository from gh CLI.');
  }
  return repo;
}

function getPullRequestHeadRef(prNumber: number, repoRef: string, cwd: string) {
  const prJson = gh(['pr', 'view', String(prNumber), '--repo', repoRef, '--json', 'headRefOid'], cwd).trim();
  const details = JSON.parse(prJson) as { headRefOid: string };
  return details.headRefOid;
}

function getPullRequestFileContent(headRef: string, repoRef: string, filePath: string, cwd: string) {
  try {
    return gh(['api', `repos/${repoRef}/contents/${encodeGitHubContentPath(filePath)}`, '-f', `ref=${headRef}`, '--jq', '.content'], cwd)
      .replace(/\n/g, '')
      .trim();
  } catch {
    return null;
  }
}

function decodeBase64(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return Buffer.from(value, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

export function getPullRequestScan(prNumber: number, cwd = process.cwd(), repo?: string): PullRequestScan {
  const repoRef = repo ?? inferGitHubRepo(cwd);
  const prJson = gh(['pr', 'view', String(prNumber), '--repo', repoRef, '--json', 'title,url'], cwd).trim();
  const details = JSON.parse(prJson) as { title: string; url: string };
  const diff = toFileScopedDiff(gh(['pr', 'diff', String(prNumber), '--repo', repoRef], cwd));
  const headRef = getPullRequestHeadRef(prNumber, repoRef, cwd);
  const files = parseFilePaths(diff).map((filePath) => ({
    path: filePath,
    content: decodeBase64(getPullRequestFileContent(headRef, repoRef, filePath, cwd)),
  }));

  return {
    title: details.title,
    url: details.url,
    diff,
    files,
  };
}
