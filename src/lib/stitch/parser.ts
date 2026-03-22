import type { ComponentReference, ReferenceToken } from "@/lib/types";
import { generateNameCandidates, toKebabCase, uniqueStrings } from "@/lib/utils";

type ParsedStitchDesign = {
  overview: string;
  tokens: ReferenceToken[];
  components: ComponentReference[];
  aliasMap: Record<string, string[]>;
};

type SectionMap = Record<string, string[]>;

function normalizeSectionHeading(rawHeading: string) {
  return rawHeading
    .trim()
    .replace(/^\d+(?:\.\d+)*\.?\s+/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toSections(markdown: string) {
  const sections: SectionMap = {};
  let current = "overview";

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headingMatch) {
      current = normalizeSectionHeading(headingMatch[1]);
      sections[current] ??= [];
      continue;
    }

    sections[current] ??= [];
    sections[current].push(line);
  }

  return sections;
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function extractInlineCodes(value: string) {
  return Array.from(value.matchAll(/`([^`]+)`/g)).map((match) => match[1].trim());
}

function extractHex(value: string) {
  return value.match(/#(?:[0-9a-fA-F]{3,8})\b/)?.[0];
}

function normalizeTokenName(prefix: string, label: string) {
  const cleaned = cleanInlineMarkdown(label).replace(/:+$/, "");
  return `${prefix}.${toKebabCase(cleaned)}`;
}

function parseColorTokens(lines: string[]) {
  const tokens: ReferenceToken[] = [];
  const aliasMap: Record<string, string[]> = {};

  for (const line of lines) {
    const text = line.trim();
    if (!text || /^#+\s/.test(text)) continue;

    const hex = extractHex(text);
    const codes = extractInlineCodes(text);
    const boldName = text.match(/\*\*([^*]+)\*\*/)?.[1];
    const beforeColon = cleanInlineMarkdown(text.replace(/^[-*]\s*/, "").split(":")[0] ?? "");
    const label = boldName ?? beforeColon;

    if (!label || (!hex && codes.length === 0)) {
      continue;
    }

    const tokenName = normalizeTokenName("color", label);
    const aliases = uniqueStrings([
      ...codes,
      label,
      ...generateNameCandidates(label),
    ]);
    const codeHints = uniqueStrings([
      ...aliases.map((alias) => `bg-${toKebabCase(alias)}`),
      ...aliases.map((alias) => `text-${toKebabCase(alias)}`),
      hex,
    ]);

    tokens.push({
      name: tokenName,
      kind: "color",
      value: hex,
      aliases,
      codeHints,
      sourceType: "stitch-design-md",
    });

    aliasMap[tokenName] = aliases;
  }

  return { tokens, aliasMap };
}

function parseTypographyTokens(lines: string[]) {
  const tokens: ReferenceToken[] = [];

  for (const line of lines) {
    const text = line.trim();
    if (!text || /^#+\s/.test(text)) continue;

    const codes = extractInlineCodes(text);
    const boldName = text.match(/\*\*([^*]+)\*\*/)?.[1];
    const beforeColon = cleanInlineMarkdown(text.replace(/^[-*]\s*/, "").split(":")[0] ?? "");
    const label = boldName ?? beforeColon;

    if (!label || codes.length === 0) {
      continue;
    }

    tokens.push({
      name: normalizeTokenName("typography", label),
      kind: "typography",
      value: codes.join(", "),
      aliases: uniqueStrings([label, ...codes, ...generateNameCandidates(label)]),
      codeHints: uniqueStrings(codes),
      sourceType: "stitch-design-md",
    });
  }

  return tokens;
}

function parseElevationTokens(lines: string[]) {
  const tokens: ReferenceToken[] = [];

  for (const line of lines) {
    const text = line.trim();
    if (!text || /^#+\s/.test(text)) continue;
    if (!/(shadow|elevation|flat|blur|spread)/i.test(text)) continue;

    const label =
      text.match(/\*\*([^*]+)\*\*/)?.[1] ??
      cleanInlineMarkdown(text.replace(/^[-*]\s*/, "").split(":")[0] ?? "");

    if (!label) continue;

    const codes = extractInlineCodes(text);
    tokens.push({
      name: normalizeTokenName("elevation", label),
      kind: "elevation",
      value: cleanInlineMarkdown(text),
      aliases: uniqueStrings([label, ...codes]),
      codeHints: uniqueStrings(codes),
      sourceType: "stitch-design-md",
    });
  }

  return tokens;
}

function collectSectionText(lines: string[]) {
  return lines.map((line) => cleanInlineMarkdown(line)).filter(Boolean).join(" ");
}

function parseComponentSections(lines: string[], tokenNames: string[]) {
  const components: ComponentReference[] = [];
  let currentName: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentName) return;

    const summary = collectSectionText(currentLines);
    const summaryLower = summary.toLowerCase();
    const variants = uniqueStrings(
      ["primary", "secondary", "ghost", "destructive", "outline", "elevated", "default"].filter(
        (variant) => summaryLower.includes(variant),
      ),
    ).map((name) => ({ name }));
    const states = uniqueStrings(
      ["hover", "focus", "disabled", "active", "pressed", "selected", "loading"].filter((state) =>
        summaryLower.includes(state),
      ),
    ).map((name) => ({ name }));
    const tokensUsed = tokenNames.filter((tokenName) => summaryLower.includes(tokenName.split(".").at(-1) ?? ""));
    const inlineCodes = currentLines.flatMap(extractInlineCodes);
    const disallowedPatterns = inlineCodes.filter((entry) => /bg-|text-|border-|rounded-|shadow-|ring-|style=/.test(entry));

    components.push({
      name: currentName,
      codeMatches: generateNameCandidates(currentName),
      aliases: uniqueStrings(generateNameCandidates(currentName)),
      summary,
      variants: variants.length ? variants : undefined,
      states: states.length ? states : undefined,
      disallowedPatterns: disallowedPatterns.length ? uniqueStrings(disallowedPatterns) : undefined,
      tokensUsed: tokensUsed.length ? tokensUsed : undefined,
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headingMatch = line.match(/^###\s+(.+?)\s*$/);
    if (headingMatch) {
      flush();
      currentName = cleanInlineMarkdown(headingMatch[1]);
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  flush();
  return components;
}

export function parseStitchDesignMarkdown(markdown: string): ParsedStitchDesign {
  const normalizedMarkdown = markdown.trim();
  if (!normalizedMarkdown) {
    throw new Error("DESIGN.md is empty.");
  }

  const sections = toSections(normalizedMarkdown);
  const overview =
    collectSectionText(sections["overview"] ?? []) ||
    collectSectionText(sections["overview & creative north star"] ?? []);
  const colorSection = sections["colors"] ?? [];
  const typographySection = sections["typography"] ?? [];
  const elevationSection = sections["elevation"] ?? [];
  const componentsSection = sections["components"] ?? [];
  const dosSection = sections["do’s and don’ts"] ?? sections["do's and don'ts"] ?? [];

  const colorTokens = parseColorTokens(colorSection);
  const typographyTokens = parseTypographyTokens(typographySection);
  const elevationTokens = parseElevationTokens(elevationSection);
  const tokenNames = [...colorTokens.tokens, ...typographyTokens, ...elevationTokens].map(
    (token) => token.name,
  );
  const components = parseComponentSections(componentsSection, tokenNames);

  if (components.length === 0 && overview) {
    components.push({
      name: "DesignSystem",
      codeMatches: ["DesignSystem"],
      aliases: ["DesignSystem"],
      summary: overview,
      disallowedPatterns: uniqueStrings(dosSection.flatMap(extractInlineCodes)),
    });
  }

  return {
    overview,
    tokens: [...colorTokens.tokens, ...typographyTokens, ...elevationTokens],
    components,
    aliasMap: colorTokens.aliasMap,
  };
}
