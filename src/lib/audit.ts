import { generateNameCandidates, hashParts, makeId, normalizeForMatch, uniqueStrings } from "@/lib/utils";
import type {
  AuditRun,
  DriftIssue,
  PullRequestDetails,
  ReferenceSnapshot,
  ReviewStatus,
} from "@/lib/types";

type AnalyzeResult = {
  issues: DriftIssue[];
  summary: AuditRun["summary"];
  fixBrief: string;
  comparison: AuditRun["comparison"];
  carriedStatuses: Array<{ fingerprint: string; status: ReviewStatus }>;
};

type PreviousIssueState = {
  issues: DriftIssue[];
  reviews: Array<{ fingerprint: string; status: ReviewStatus }>;
  runId?: string;
};

function createIssue(
  auditRunId: string,
  componentName: string,
  filePath: string,
  issueType: DriftIssue["issueType"],
  severity: DriftIssue["severity"],
  confidence: number,
  expected: string,
  found: string,
  suggestedAction: string,
  evidenceSnippet: string,
) {
  return {
    id: makeId("issue"),
    auditRunId,
    fingerprint: hashParts([componentName, issueType, filePath, expected, found]),
    componentName,
    issueType,
    severity,
    confidence,
    expected,
    found,
    filePath,
    evidenceSnippet: evidenceSnippet.slice(0, 400),
    suggestedAction,
  } satisfies DriftIssue;
}

function extractLikelyVariants(content: string) {
  const variants = new Set<string>();
  const cvaMatch = content.match(/variants?\s*:\s*\{([\s\S]{0,1200}?)\n\s*\}/);

  if (cvaMatch?.[1]) {
    for (const match of cvaMatch[1].matchAll(/([A-Za-z0-9_-]+)\s*:/g)) {
      variants.add(match[1]);
    }
  }

  const unionMatch = content.match(/variant\??:\s*("([^"]+)"(?:\s*\|\s*"[^"]+")*)/);
  if (unionMatch?.[1]) {
    for (const value of unionMatch[1].split("|")) {
      variants.add(value.replace(/"/g, "").trim());
    }
  }

  return [...variants];
}

function collectEvidence(text: string, patterns: string[]) {
  const lines = text.split("\n");

  for (const pattern of patterns) {
    const line = lines.find((entry) => entry.includes(pattern));
    if (line) {
      return line.trim();
    }
  }

  return lines.find((entry) => entry.trim())?.trim() ?? "No direct snippet available.";
}

function hasCandidateMatch(text: string, normalizedText: string, candidates: string[]) {
  return candidates.some((candidate) => {
    const normalized = normalizeForMatch(candidate);
    return text.includes(candidate.toLowerCase()) || (normalized.length > 2 && normalizedText.includes(normalized));
  });
}

function buildComponentCandidates(component: ReferenceSnapshot["components"][number]) {
  return uniqueStrings([
    component.name,
    ...(component.codeMatches ?? []),
    ...(component.aliases ?? []),
    ...generateNameCandidates(component.name),
  ]);
}

function buildTokenCandidateMap(snapshot: ReferenceSnapshot) {
  const map = new Map<string, string[]>();

  for (const token of snapshot.tokens) {
    map.set(
      token.name,
      uniqueStrings([
        token.name,
        ...(token.aliases ?? []),
        ...(token.codeHints ?? []),
        ...(snapshot.aliasMap?.[token.name] ?? []),
      ]),
    );
  }

  return map;
}

function collectComponentTokenCandidates(
  component: ReferenceSnapshot["components"][number],
  tokenCandidateMap: Map<string, string[]>,
) {
  return uniqueStrings(
    (component.tokensUsed ?? []).flatMap((tokenName) => tokenCandidateMap.get(tokenName) ?? []),
  );
}

function findMatchedCandidates(text: string, normalizedText: string, candidates: string[]) {
  return candidates.filter((candidate) => hasCandidateMatch(text, normalizedText, [candidate]));
}

function hasStyleSignals(text: string) {
  return /className|style=\{\{|bg-|text-|border-|rounded-|px-|py-|shadow-|ring-/.test(text);
}

function detectStateSignals(text: string) {
  return uniqueStrings([
    ...(text.match(/(?:^|[^a-z])(hover|focus-visible|focus|disabled|active|pressed|selected|loading):/g) ?? []).map((match) =>
      match.replace(/[^a-z-]/g, "").replace(/:$/, ""),
    ),
    ...(text.match(/aria-disabled/g) ?? []),
    ...(text.match(/data-\[state=[^\]]+\]/g) ?? []),
  ]);
}

function normalizeStateSignal(name: string) {
  const normalized = normalizeForMatch(name);
  if (normalized.includes("hover")) return "hover";
  if (normalized.includes("focusvisible") || normalized.includes("focus")) return "focus";
  if (normalized.includes("disabled")) return "disabled";
  if (normalized.includes("pressed") || normalized.includes("active")) return "active";
  if (normalized.includes("selected")) return "selected";
  if (normalized.includes("loading")) return "loading";
  return "";
}

function detectResponsiveSignals(text: string) {
  return uniqueStrings([
    ...(text.match(/(?:^|[^a-z])(sm|md|lg|xl|2xl):/g) ?? []).map((match) =>
      match.replace(/[^a-z0-9]/g, ""),
    ),
    ...(text.match(/container(?![a-z-])/g) ?? []),
    ...(text.match(/max-w-|min-w-|w-full|grid-cols-|basis-|gap-|flex-wrap/g) ?? []),
  ]);
}

function hasBreakpointSpecificClasses(text: string) {
  return /(?:^|[^a-z])(sm|md|lg|xl|2xl):/.test(text);
}

function severityRank(severity: DriftIssue["severity"]) {
  return severity === "high" ? 0 : severity === "medium" ? 1 : 2;
}

function summarizeIssue(issue: DriftIssue) {
  return `${issue.issueType} in ${issue.filePath}: expected ${issue.expected}; found ${issue.found}.`;
}

export function generateFixBrief(
  pr: PullRequestDetails,
  issues: DriftIssue[],
  reviews: Map<string, ReviewStatus>,
) {
  const activeIssues = issues.filter((issue) => {
    const status = reviews.get(issue.fingerprint);
    return status !== "intentional" && status !== "ignore";
  });

  const sortedIssues = [...activeIssues].sort((a, b) => {
    const severityDiff = severityRank(a.severity) - severityRank(b.severity);
    if (severityDiff !== 0) return severityDiff;
    const confidenceDiff = b.confidence - a.confidence;
    if (confidenceDiff !== 0) return confidenceDiff;
    return a.filePath.localeCompare(b.filePath) || a.componentName.localeCompare(b.componentName);
  });

  const components = [...new Set(sortedIssues.map((issue) => issue.componentName))];
  const files = [...new Set(sortedIssues.map((issue) => issue.filePath))];
  const byComponent = sortedIssues.reduce<Record<string, DriftIssue[]>>((acc, issue) => {
    acc[issue.componentName] ??= [];
    acc[issue.componentName].push(issue);
    return acc;
  }, {});
  const byType = sortedIssues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.issueType] = (acc[issue.issueType] ?? 0) + 1;
    return acc;
  }, {});

  const topActions = sortedIssues.slice(0, 6).map((issue) => {
    return `- ${issue.componentName} (${issue.severity}): ${issue.suggestedAction}`;
  });

  const fileMap = files
    .map((filePath) => {
      const related = sortedIssues.filter((issue) => issue.filePath === filePath);
      return `- ${filePath} (${related.length} issue${related.length === 1 ? "" : "s"})`;
    })
    .join("\n");

  const componentBlocks = components
    .map((componentName) => {
      const componentIssues = byComponent[componentName] ?? [];
      const issueLines = componentIssues
        .map(
          (issue, index) =>
            `  ${index + 1}. ${summarizeIssue(issue)} Action: ${issue.suggestedAction} Evidence: ${issue.evidenceSnippet}`,
        )
        .join("\n");

      return [
        `- ${componentName}`,
        componentIssues.length ? issueLines : `  No active issues.`,
      ].join("\n");
    })
    .join("\n\n");

  const sections = [
    `FIX BRIEF`,
    `PR #${pr.number}: ${pr.title}`,
    `Source: ${pr.url}`,
    ``,
    `What this is`,
    `Use this as the implementation task list for a coding agent. Fix the highest-priority drift first, keep design tokens and shared components intact, and do not invent new UI patterns unless the Figma reference requires them.`,
    ``,
    `Priority`,
    `- High severity: ${sortedIssues.filter((issue) => issue.severity === "high").length}`,
    `- Medium severity: ${sortedIssues.filter((issue) => issue.severity === "medium").length}`,
    `- Low severity: ${sortedIssues.filter((issue) => issue.severity === "low").length}`,
    ``,
    `Issue types`,
    Object.entries(byType)
      .map(([type, count]) => `- ${type}: ${count}`)
      .join("\n") || `- none`,
    ``,
    `Affected components`,
    components.length ? components.join(", ") : `None`,
    ``,
    `Affected files`,
    fileMap || `None`,
    ``,
    `Do these first`,
    topActions.length ? topActions.join("\n") : `- No active issues.`,
    ``,
    `Component-by-component notes`,
    componentBlocks || `None`,
    ``,
    `Expected outcome`,
    `- Shared tokens stay shared.`,
    `- Approved variants and states match the design reference.`,
    `- Raw hardcoded styling is replaced where the design system already has a primitive.`,
    `- The PR becomes a clean yes/no pass instead of a maybe.`,
  ];

  return sections.join("\n");
}

export function generateCheckSummary(
  pr: PullRequestDetails,
  issues: DriftIssue[],
  reviews: Map<string, ReviewStatus>,
) {
  const activeIssues = issues.filter((issue) => {
    const status = reviews.get(issue.fingerprint);
    return status !== "intentional" && status !== "ignore";
  });
  const sortedIssues = [...activeIssues].sort((a, b) => {
    const severityDiff = severityRank(a.severity) - severityRank(b.severity);
    if (severityDiff !== 0) return severityDiff;
    return b.confidence - a.confidence;
  });
  const counts = sortedIssues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.issueType] = (acc[issue.issueType] ?? 0) + 1;
    return acc;
  }, {});
  const topFiles = [...new Set(sortedIssues.map((issue) => issue.filePath))].slice(0, 5);
  const topIssues = sortedIssues.slice(0, 5).map((issue) => `- ${issue.componentName}: ${issue.suggestedAction}`);

  return [
    `Design Memory check`,
    `PR #${pr.number}: ${pr.title}`,
    `Active issues: ${sortedIssues.length}`,
    `High: ${sortedIssues.filter((issue) => issue.severity === "high").length} | Medium: ${sortedIssues.filter((issue) => issue.severity === "medium").length} | Low: ${sortedIssues.filter((issue) => issue.severity === "low").length}`,
    `Issue types: ${Object.entries(counts).map(([type, count]) => `${type}=${count}`).join(", ") || "none"}`,
    `Top files: ${topFiles.length ? topFiles.join(", ") : "none"}`,
    `Top actions:`,
    topIssues.length ? topIssues.join("\n") : `- No active issues.`,
  ].join("\n");
}

export function analyzeDrift(
  auditRunId: string,
  snapshot: ReferenceSnapshot,
  pr: PullRequestDetails,
  previous?: PreviousIssueState,
): AnalyzeResult {
  const issues: DriftIssue[] = [];
  const tokenCandidateMap = buildTokenCandidateMap(snapshot);

  for (const file of pr.files) {
    const text = [file.patch ?? "", file.contents ?? ""].join("\n");
    const fileLower = `${file.filename}\n${text}`.toLowerCase();
    const normalizedFile = normalizeForMatch(`${file.filename}\n${text}`);

    for (const component of snapshot.components) {
      const componentCandidates = buildComponentCandidates(component);
      const componentMatch = hasCandidateMatch(fileLower, normalizedFile, componentCandidates);

      if (!componentMatch) {
        continue;
      }

      const componentTokenCandidates = collectComponentTokenCandidates(component, tokenCandidateMap);
      const matchedTokenCandidates = findMatchedCandidates(
        fileLower,
        normalizedFile,
        componentTokenCandidates.map((candidate) => candidate.toLowerCase()),
      );
      const missingPatterns = (component.requiredPatterns ?? []).filter(
        (pattern) => !text.includes(pattern),
      );

      if (
        missingPatterns.length > 0 ||
        (componentTokenCandidates.length > 0 &&
          matchedTokenCandidates.length === 0 &&
          hasStyleSignals(text))
      ) {
        issues.push(
          createIssue(
            auditRunId,
            component.name,
            file.filename,
            "token-mismatch",
            missingPatterns.length > 2 ? "high" : "medium",
            0.76,
            missingPatterns.length > 0
              ? `shared patterns ${missingPatterns.join(", ")}`
              : `recognized token aliases ${componentTokenCandidates.slice(0, 6).join(", ")}`,
            matchedTokenCandidates.length > 0
              ? `partial token coverage ${matchedTokenCandidates.join(", ")}`
              : "no recognized token aliases or code hints were found in the changed implementation",
            "Reintroduce the shared utility/token patterns or aliases used by the approved component.",
            collectEvidence(
              text,
              [...missingPatterns, ...componentTokenCandidates, ...(component.codeMatches ?? [])].slice(0, 8),
            ),
          ),
        );
      }

      const hardcodedSignals = [
        ...new Set(
          [
            ...(text.match(/#[0-9a-fA-F]{3,8}/g) ?? []),
            ...(text.match(/[a-z-]+-\[[^\]]+\]/g) ?? []),
          ].slice(0, 6),
        ),
      ];
      const hasDisallowedPattern = (component.disallowedPatterns ?? []).some((pattern) =>
        text.includes(pattern),
      );

      if (hardcodedSignals.length > 0 || hasDisallowedPattern) {
        issues.push(
          createIssue(
            auditRunId,
            component.name,
            file.filename,
            "hardcoded-style",
            matchedTokenCandidates.length === 0 ? "high" : "medium",
            matchedTokenCandidates.length === 0 ? 0.86 : 0.74,
            componentTokenCandidates.length > 0
              ? `shared tokens or aliases such as ${componentTokenCandidates.slice(0, 4).join(", ")}`
              : "shared tokens or named utilities from the approved system",
            hardcodedSignals.length
              ? `hardcoded values ${hardcodedSignals.join(", ")}`
              : "disallowed raw styling pattern",
            "Replace raw values and arbitrary utilities with the component's approved design tokens.",
            collectEvidence(
              text,
              hardcodedSignals.length ? hardcodedSignals : component.disallowedPatterns ?? [],
            ),
          ),
        );
      }

      const stateSignals = detectStateSignals(text);
      const expectedStateSignals = uniqueStrings(
        (component.states ?? []).map((state) => normalizeStateSignal(state.name)).filter(Boolean),
      );
      const missingBehaviorSignals = expectedStateSignals.filter(
        (signal) => !stateSignals.includes(signal),
      );

      if (missingBehaviorSignals.length > 0) {
        issues.push(
          createIssue(
            auditRunId,
            component.name,
            file.filename,
            "behavior-drift",
            "medium",
            0.72,
            `interaction states ${expectedStateSignals.join(", ")}`,
            `missing interaction markers for ${missingBehaviorSignals.join(", ")}`,
            "Add the hover, focus, disabled, active, or selected branches that the design system expects.",
            collectEvidence(text, missingBehaviorSignals),
          ),
        );
      }

      const responsiveSignals = detectResponsiveSignals(text);
      const looksResponsive =
        /(layout|page|card|section|header|footer|sidebar|nav|menu|modal|dialog|drawer|hero|grid)/i.test(
          component.name,
        ) || /responsive/i.test(component.summary ?? "");
      if (
        looksResponsive &&
        /flex|grid|w-full|max-w-|min-w-|basis-|gap-/.test(text) &&
        !hasBreakpointSpecificClasses(text) &&
        responsiveSignals.length > 0
      ) {
        issues.push(
          createIssue(
            auditRunId,
            component.name,
            file.filename,
            "responsive-drift",
            "low",
            0.66,
            "breakpoint-aware layout handling",
            `only base layout signals were found: ${responsiveSignals.slice(0, 5).join(", ")}`,
            "Add breakpoint-specific classes or container rules so the layout adapts at different widths.",
            collectEvidence(text, responsiveSignals),
          ),
        );
      }

      if (component.variants?.length) {
        const allowedVariants = component.variants.map((variant) => variant.name);
        const detectedVariants = extractLikelyVariants(text);
        const unexpectedVariants = detectedVariants.filter(
          (variant) =>
            !allowedVariants.some(
              (allowed) => normalizeForMatch(allowed) === normalizeForMatch(variant),
            ),
        );

        if (unexpectedVariants.length > 0) {
          issues.push(
            createIssue(
              auditRunId,
              component.name,
              file.filename,
              "variant-drift",
              "medium",
              0.7,
              `allowed variants ${allowedVariants.join(", ")}`,
              `unexpected variants ${unexpectedVariants.join(", ")}`,
              "Rename or remove custom variants so the code matches the approved Figma variant set.",
              collectEvidence(text, unexpectedVariants),
            ),
          );
        }
      }

      const missingStates = (component.states ?? []).filter((state) =>
        (state.requiredPatterns ?? []).every((pattern) => !text.includes(pattern)),
      );

      if (missingStates.length > 0) {
        issues.push(
          createIssue(
            auditRunId,
            component.name,
            file.filename,
            "missing-state",
            "medium",
            0.73,
            `state coverage for ${missingStates.map((state) => state.name).join(", ")}`,
            "required interaction or disabled-state markers are missing",
            "Add the missing state styles or variant branches for the approved interaction model.",
            collectEvidence(
              text,
              missingStates.flatMap((state) => state.requiredPatterns ?? []),
            ),
          ),
        );
      }

      const sharedPrimitiveRules = [
        {
          matches: /button/i,
          rawPattern: "<button",
          importPattern: "import { Button",
          componentPattern: "<Button",
          expected: "shared Button component usage",
          found: "raw <button> markup detected in a file that appears to touch Button behavior",
          action: "Prefer the shared Button primitive unless this is a documented exception.",
        },
        {
          matches: /input/i,
          rawPattern: "<input",
          importPattern: "import { Input",
          componentPattern: "<Input",
          expected: "shared Input component usage",
          found: "raw <input> markup detected in a file that appears to touch Input behavior",
          action: "Prefer the shared Input primitive unless this is a documented exception.",
        },
        {
          matches: /textarea/i,
          rawPattern: "<textarea",
          importPattern: "import { Textarea",
          componentPattern: "<Textarea",
          expected: "shared Textarea component usage",
          found: "raw <textarea> markup detected in a file that appears to touch Textarea behavior",
          action: "Prefer the shared Textarea primitive unless this is a documented exception.",
        },
      ];

      for (const rule of sharedPrimitiveRules) {
        if (
          rule.matches.test(component.name) &&
          text.includes(rule.rawPattern) &&
          !text.includes(rule.importPattern) &&
          !text.includes(rule.componentPattern)
        ) {
          issues.push(
            createIssue(
              auditRunId,
              component.name,
              file.filename,
              "component-reuse",
              "low",
              0.49,
              rule.expected,
              rule.found,
              rule.action,
              collectEvidence(text, [rule.rawPattern]),
            ),
          );
          break;
        }
      }
    }
  }

  const dedupedIssues = Array.from(new Map(issues.map((issue) => [issue.fingerprint, issue])).values());
  const byType = dedupedIssues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.issueType] = (acc[issue.issueType] ?? 0) + 1;
    return acc;
  }, {});

  const previousFingerprints = new Set(previous?.issues.map((issue) => issue.fingerprint) ?? []);
  const currentFingerprints = new Set(dedupedIssues.map((issue) => issue.fingerprint));
  const resolvedFingerprints = [...previousFingerprints].filter(
    (fingerprint) => !currentFingerprints.has(fingerprint),
  );
  const remainingFingerprints = [...currentFingerprints].filter((fingerprint) =>
    previousFingerprints.has(fingerprint),
  );
  const newFingerprints = [...currentFingerprints].filter(
    (fingerprint) => !previousFingerprints.has(fingerprint),
  );
  const carriedStatuses =
    previous?.reviews.filter((review) => currentFingerprints.has(review.fingerprint)) ?? [];
  const reviewMap = new Map(carriedStatuses.map((review) => [review.fingerprint, review.status]));

  return {
    issues: dedupedIssues,
    summary: {
      totalIssues: dedupedIssues.length,
      high: dedupedIssues.filter((issue) => issue.severity === "high").length,
      medium: dedupedIssues.filter((issue) => issue.severity === "medium").length,
      low: dedupedIssues.filter((issue) => issue.severity === "low").length,
      byType,
      resolvedCount: resolvedFingerprints.length,
      remainingCount: remainingFingerprints.length,
    },
    fixBrief: generateFixBrief(pr, dedupedIssues, reviewMap),
    comparison: {
      baselineRunId: previous?.runId,
      resolvedFingerprints,
      remainingFingerprints,
      newFingerprints,
    },
    carriedStatuses,
  };
}
