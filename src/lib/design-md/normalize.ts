import type { ComponentReference, ReferenceSnapshot, ReferenceToken } from '../types';
import { generateNameCandidates, toKebabCase, uniqueStrings } from '../utils';

const GENERIC_HEADINGS = new Set([
  'overview',
  'summary',
  'principles',
  'rules',
  'guidelines',
  'colors',
  'typography',
  'spacing',
  'elevation',
  'tokens',
]);

function extractHexTokens(markdown: string): ReferenceToken[] {
  return Array.from(new Set(markdown.match(/#(?:[0-9a-fA-F]{3,8})\b/g) ?? [])).map((hex, index) => ({
    name: `color.reference-${index + 1}`,
    kind: 'color',
    value: hex,
    aliases: [hex],
    codeHints: [hex],
    sourceType: 'design-md',
  }));
}

function extractCodeTokens(markdown: string): ReferenceToken[] {
  const codes = Array.from(markdown.matchAll(/`([^`]+)`/g)).map((match) => match[1].trim());
  return uniqueStrings(codes)
    .filter((code) => /(bg-|text-|border-|ring-|rounded-|shadow-|p-|px-|py-|m-|mx-|my-|gap-)/.test(code))
    .map((code) => ({
      name: `hint.${toKebabCase(code)}`,
      kind: 'utility',
      aliases: [code],
      codeHints: [code],
      sourceType: 'design-md',
    }));
}

function extractComponentReferences(markdown: string): ComponentReference[] {
  const lines = markdown.split('\n');
  const headings = lines
    .map((line) => line.match(/^#{2,3}\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value) => !GENERIC_HEADINGS.has(value.toLowerCase()));

  const references = uniqueStrings(headings).map((heading) => ({
    name: heading,
    codeMatches: generateNameCandidates(heading),
    aliases: generateNameCandidates(heading),
    summary: `Derived from ${heading} section in DESIGN.md.`,
  }));

  if (references.length > 0) {
    return references;
  }

  return [
    {
      name: 'DesignSystem',
      codeMatches: ['DesignSystem'],
      aliases: ['DesignSystem'],
      summary: markdown.slice(0, 280).trim(),
    },
  ];
}

export function normalizeDesignMarkdown(markdown: string, fileName = 'DESIGN.md'): ReferenceSnapshot {
  const hexTokens = extractHexTokens(markdown);
  const codeTokens = extractCodeTokens(markdown);
  const allTokens = [...hexTokens, ...codeTokens];
  const components = extractComponentReferences(markdown);

  return {
    metadata: {
      source: 'design-md',
      versionLabel: fileName,
      importedAt: new Date().toISOString(),
      fileName,
      tokenCount: allTokens.length,
      componentCount: components.length,
    },
    tokens: allTokens,
    components,
    aliasMap: Object.fromEntries(allTokens.map((token) => [token.name, uniqueStrings([...(token.aliases ?? []), ...(token.codeHints ?? [])])])),
  };
}
