import fs from 'fs';
import path from 'path';
import { fetchFigmaFileBundle } from './figma/fetch-file';
import { extractReferenceTokens } from './figma/extract-tokens';

type DesignContextOptions = {
  cwd?: string;
};

function readIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return '';
  }

  return fs.readFileSync(filePath, 'utf-8');
}

function findFirstExisting(cwd: string, candidates: string[]) {
  for (const candidate of candidates) {
    const fullPath = path.join(cwd, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

function extractFigmaFileKey(config: Record<string, unknown>): string | null {
  const directKey =
    typeof config.figmaFileKey === 'string'
      ? config.figmaFileKey
      : typeof config.figmaTokenFileKey === 'string'
        ? config.figmaTokenFileKey
        : null;

  if (directKey) {
    return directKey;
  }

  const figmaUrl =
    typeof config.figmaUrl === 'string'
      ? config.figmaUrl
      : typeof config.designSource === 'string'
        ? config.designSource
        : null;

  return figmaUrl ? extractFileKey(figmaUrl) : null;
}

export async function getDesignContext(options: DesignContextOptions = {}): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const chunks: string[] = [];

  const designPath = findFirstExisting(cwd, ['design.md', 'DESIGN.md']);
  if (designPath) {
    chunks.push(`DESIGN SPECIFICATION (from ${path.basename(designPath)}):\n${readIfExists(designPath)}`);
  }

  const cursorRulesPath = path.join(cwd, '.cursorrules');
  if (fs.existsSync(cursorRulesPath)) {
    chunks.push(`PROJECT RULES (from .cursorrules):\n${readIfExists(cursorRulesPath)}`);
  }

  const configPath = findFirstExisting(cwd, ['design-memory.json', 'design-memory.config.json']);
  if (configPath) {
    try {
      const config = JSON.parse(readIfExists(configPath)) as Record<string, unknown>;
      const figmaFileKey = extractFigmaFileKey(config);

      if (figmaFileKey && process.env.FIGMA_ACCESS_TOKEN) {
        const bundle = await fetchFigmaFileBundle(figmaFileKey);
        const tokens = extractReferenceTokens(bundle);
        chunks.push(`LATEST DESIGN TOKENS (from Figma):\n${JSON.stringify(tokens, null, 2)}`);
      }
    } catch {
      // Keep local audit flow resilient even when config parsing or token fetch fails.
    }
  }

  return chunks.join('\n\n').trim();
}

function extractFileKey(url: string): string | null {
  const match = url.match(/figma\.com\/(file|design)\/([a-zA-Z0-9]+)/);
  return match ? match[2] : null;
}
