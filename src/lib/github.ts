import { execFileSync } from 'node:child_process';

export type PullRequestScan = {
  title: string;
  url: string;
  diff: string;
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

export function getPullRequestScan(prNumber: number, cwd = process.cwd(), repo?: string): PullRequestScan {
  const repoRef = repo ?? inferGitHubRepo(cwd);
  const prJson = gh(['pr', 'view', String(prNumber), '--repo', repoRef, '--json', 'title,url'], cwd).trim();
  const details = JSON.parse(prJson) as { title: string; url: string };
  const diff = toFileScopedDiff(gh(['pr', 'diff', String(prNumber), '--repo', repoRef], cwd));

  return {
    title: details.title,
    url: details.url,
    diff,
  };
}
