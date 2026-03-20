import type { ReferenceSnapshot } from "@/lib/types";

export const sampleReferenceSnapshot: ReferenceSnapshot = {
  metadata: {
    source: "figma-fixture",
    versionLabel: "Serendipity Fixture v2",
    figmaFileKey: "SERENDIPITY-FIXTURE-V2",
    fileName: "Serendipity Fixture",
  },
  tokens: [
    {
      name: "color.brand.primary",
      kind: "color",
      value: "#0D5FFF",
      aliases: ["bg-brand-primary"],
      codeHints: ["bg-sky-600", "text-sky-50"],
    },
    {
      name: "color.brand.primaryHover",
      kind: "color",
      value: "#004EEB",
      codeHints: ["hover:bg-sky-700"],
    },
    {
      name: "color.surface.default",
      kind: "color",
      value: "#FFFFFF",
      codeHints: ["bg-white"],
    },
    {
      name: "color.surface.elevated",
      kind: "color",
      value: "rgba(255,255,255,0.8)",
      codeHints: ["bg-white/80"],
    },
    {
      name: "color.border.default",
      kind: "color",
      value: "#E2E8F0",
      codeHints: ["border-slate-200"],
    },
    {
      name: "radius.control",
      kind: "radius",
      value: "9999px",
      codeHints: ["rounded-full"],
    },
    {
      name: "radius.card",
      kind: "radius",
      value: "24px",
      codeHints: ["rounded-3xl"],
    },
    {
      name: "spacing.control.x",
      kind: "spacing",
      value: "16px",
      codeHints: ["px-4"],
    },
    {
      name: "spacing.control.y",
      kind: "spacing",
      value: "10px",
      codeHints: ["py-2.5", "py-3"],
    },
    {
      name: "state.focus.ring",
      kind: "state",
      value: "2px",
      codeHints: ["focus-visible:ring-2", "focus-visible:ring-sky-300"],
    },
  ],
  components: [
    {
      name: "Button",
      codeMatches: ["Button", "buttonVariants"],
      aliases: ["primary action", "cta button"],
      summary: "Single-purpose action primitive with explicit variants and focus state.",
      requiredPatterns: ["rounded-full", "px-4", "py-2.5", "focus-visible:ring-2"],
      disallowedPatterns: ["bg-[#", "rounded-[", "px-[", "py-[", "style={{"],
      variants: [
        { name: "primary", requiredPatterns: ["bg-sky-600", "text-sky-50"] },
        { name: "secondary", requiredPatterns: ["bg-white", "text-slate-900"] },
        { name: "ghost", requiredPatterns: ["bg-transparent"] },
      ],
      states: [
        { name: "hover", requiredPatterns: ["hover:bg-sky-700"] },
        { name: "focus", requiredPatterns: ["focus-visible:ring-2"] },
        { name: "disabled", requiredPatterns: ["disabled:opacity-50"] },
      ],
    },
    {
      name: "Input",
      codeMatches: ["Input", "inputVariants"],
      aliases: ["form field", "text input"],
      summary: "Text input primitive with shared radius, border, and error state coverage.",
      requiredPatterns: ["rounded-2xl", "border-slate-200", "px-4", "py-3", "focus-visible:ring-2"],
      disallowedPatterns: ["border-[#", "rounded-[", "shadow-[", "style={{"],
      variants: [
        { name: "default", requiredPatterns: ["bg-white"] },
        { name: "error", requiredPatterns: ["border-rose-400", "text-rose-900"] },
      ],
      states: [
        { name: "focus", requiredPatterns: ["focus-visible:ring-2"] },
        { name: "disabled", requiredPatterns: ["disabled:bg-slate-100"] },
      ],
    },
    {
      name: "Card",
      codeMatches: ["Card", "FeatureCard"],
      aliases: ["surface", "panel"],
      summary: "Shared content surface with elevated and default treatments.",
      requiredPatterns: ["rounded-3xl", "border-slate-200", "bg-white/80"],
      disallowedPatterns: ["bg-[#", "shadow-[", "border-[#", "style={{"],
      variants: [
        { name: "default", requiredPatterns: ["shadow-sm"] },
        { name: "elevated", requiredPatterns: ["shadow-lg"] },
      ],
      states: [{ name: "hover", requiredPatterns: ["hover:border-slate-300"] }],
    },
  ],
  aliasMap: {
    "bg-brand-primary": ["bg-sky-600"],
    "text-brand-on-primary": ["text-sky-50"],
    "surface-elevated": ["bg-white/80"],
  },
};
