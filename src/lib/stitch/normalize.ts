import { parseStitchDesignMarkdown } from "../stitch/parser";
import type { ReferenceSnapshot } from "../types";

export function normalizeStitchReference(
  markdownContent: string,
  options?: { fileName?: string; stitchUrl?: string },
): ReferenceSnapshot {
  const parsed = parseStitchDesignMarkdown(markdownContent);

  return {
    metadata: {
      source: "stitch-design-md",
      versionLabel: "Stitch DESIGN.md Import",
      stitchUrl: options?.stitchUrl,
      importedAt: new Date().toISOString(),
      fileName: options?.fileName ?? "DESIGN.md",
      tokenCount: parsed.tokens.length,
      componentCount: parsed.components.length,
      variantCount: parsed.components.reduce((count, component) => count + (component.variants?.length ?? 0), 0),
      stateCount: parsed.components.reduce((count, component) => count + (component.states?.length ?? 0), 0),
    },
    tokens: parsed.tokens,
    components: parsed.components,
    aliasMap: parsed.aliasMap,
  };
}
