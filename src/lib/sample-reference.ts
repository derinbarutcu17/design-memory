import type { ReferenceSnapshot } from "@/lib/types";

export const sampleReferenceSnapshot: ReferenceSnapshot = {
  metadata: {
    source: "figma-export",
    versionLabel: "Demo system v1",
    figmaFileKey: "DM-V1-DEMO",
  },
  tokens: [
    {
      name: "color.brand.primary",
      kind: "color",
      value: "#0D5FFF",
      codeHints: ["bg-sky-600", "text-sky-50"],
      aliases: ["bg-brand-primary"],
    },
    {
      name: "radius.control",
      kind: "radius",
      value: "9999px",
      codeHints: ["rounded-full"],
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
      codeHints: ["py-2.5"],
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
      summary: "Primary app actions with strict token and state coverage.",
      requiredPatterns: [
        "rounded-full",
        "px-4",
        "py-2.5",
        "focus-visible:ring-2",
      ],
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
      summary: "Text inputs should use shared border, radius, and focus tokens.",
      requiredPatterns: [
        "rounded-2xl",
        "border-slate-200",
        "px-4",
        "py-3",
        "focus-visible:ring-2",
      ],
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
      summary: "Cards should reuse the neutral surface system and shared radius.",
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
  },
};
