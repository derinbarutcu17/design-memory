import { getStagedDiff } from './git';
import { getDesignContext } from './context';
import { detectAvailableBrain, promptBrain } from './engine';
import { readConfig } from './config';
import { getPullRequestScan } from './github';

export type AuditViolation = {
  file: string;
  issue: string;
};

export type AuditResult = {
  driftDetected: boolean;
  violations: AuditViolation[];
};

export type DeterministicViolation = AuditViolation & {
  type: 'banned-hex';
};

export function buildAuditPrompt(context: string, diff: string) {
  return {
    systemPrompt: `You are an automated design enforcer. Review the provided Git diff against the design specification. Identify any deviation in spacing, typography, color tokens, or component structure.
You must output raw JSON in the exact format:
{
  "driftDetected": boolean,
  "violations": [
    { "file": string, "issue": string }
  ]
}`,
    userPrompt: `DESIGN CONTEXT:
${context}

GIT DIFF:
${diff}`,
  };
}

export function parseAuditResult(response: string): AuditResult {
  const parsed = JSON.parse(response) as Partial<AuditResult>;
  const violations = Array.isArray(parsed.violations)
    ? parsed.violations.filter(
        (item): item is AuditViolation =>
          Boolean(item) &&
          typeof item.file === 'string' &&
          item.file.length > 0 &&
          typeof item.issue === 'string' &&
          item.issue.length > 0,
      )
    : [];

  if (typeof parsed.driftDetected !== 'boolean') {
    throw new Error('Audit brain returned invalid JSON: missing driftDetected boolean.');
  }

  return {
    driftDetected: parsed.driftDetected,
    violations,
  };
}

type AuditDependencies = {
  getDiff?: typeof getStagedDiff;
  getContext?: typeof getDesignContext;
  getBrain?: typeof detectAvailableBrain;
  askBrain?: typeof promptBrain;
  exit?: typeof process.exit;
};

type AuditOptions = {
  cwd?: string;
  mode?: 'staged' | 'scan';
  diff?: string;
  label?: string;
};

function uniqueViolations(violations: AuditViolation[]) {
  const seen = new Set<string>();
  return violations.filter((violation) => {
    const key = `${violation.file}::${violation.issue}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function findDeterministicViolations(diff: string, context: string): DeterministicViolation[] {
  const allowedHexes = new Set((context.match(/#(?:[0-9a-fA-F]{3,8})\b/g) ?? []).map((hex) => hex.toLowerCase()));
  const fileBlocks = diff.split(/^FILE:\s+/m).map((block) => block.trim()).filter(Boolean);
  const violations: DeterministicViolation[] = [];

  for (const block of fileBlocks) {
    const [header, ...rest] = block.split('\n');
    const file = header.trim();
    const body = rest.join('\n');
    const hexes = Array.from(new Set(body.match(/#(?:[0-9a-fA-F]{3,8})\b/g) ?? []));

    for (const hex of hexes) {
      if (!allowedHexes.has(hex.toLowerCase())) {
        violations.push({
          file,
          issue: `Deterministic violation: raw hex ${hex} does not appear in the approved design context.`,
          type: 'banned-hex',
        });
      }
    }
  }

  return violations;
}

export async function scanPullRequest(prNumber: number, cwd = process.cwd()) {
  const scan = getPullRequestScan(prNumber, cwd);
  return runAudit({}, {
    cwd,
    mode: 'scan',
    diff: scan.diff,
    label: `PR #${prNumber}: ${scan.title}\nSource: ${scan.url}`,
  });
}

export async function runAudit(deps: AuditDependencies = {}, options: AuditOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const config = readConfig(cwd);
  const getDiff = deps.getDiff ?? ((targetCwd?: string) => getStagedDiff(targetCwd ?? cwd));
  const getContext = deps.getContext ?? getDesignContext;
  const getBrain = deps.getBrain ?? detectAvailableBrain;
  const askBrain = deps.askBrain ?? promptBrain;
  const exit = deps.exit ?? process.exit;

  console.log('\x1b[36m%s\x1b[0m', '[Design Memory] Starting audit...');

  const diff = options.diff ?? getDiff(cwd);
  if (!diff) {
    console.log('[Design Memory] No staged UI changes detected. Skipping audit.');
    exit(0);
    return;
  }

  const context = await getContext({ cwd });
  const deterministicViolations = findDeterministicViolations(diff, context);
  const brain = await getBrain();

  if (options.label) {
    console.log(`[Design Memory] ${options.label}`);
  }

  if (!brain) {
    console.error('\x1b[31m%s\x1b[0m', '[Design Memory] Error: No AI brain discovered. Please run Ollama, LM Studio, or set OPENAI_API_KEY / ANTHROPIC_API_KEY.');
    exit(1);
    return;
  }

  console.log(`[Design Memory] Using brain: ${brain.provider}`);
  const { systemPrompt, userPrompt } = buildAuditPrompt(
    context,
    deterministicViolations.length
      ? `DETERMINISTIC FACTS:\n${deterministicViolations.map((item) => `- ${item.file}: ${item.issue}`).join('\n')}\n\nGIT DIFF:\n${diff}`
      : diff,
  );

  try {
    let response = '';
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= config.ai.maxRetries; attempt += 1) {
      try {
        response = await askBrain(brain, systemPrompt, userPrompt);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError && !response) {
      throw lastError;
    }

    const llmResult = parseAuditResult(response);
    const result: AuditResult = {
      driftDetected: deterministicViolations.length > 0 || llmResult.driftDetected,
      violations: uniqueViolations([...deterministicViolations, ...llmResult.violations]),
    };

    if (result.driftDetected) {
      console.error('\x1b[31m%s\x1b[0m', '\n[Design Memory] ❌ Design drift detected:');
      for (const v of result.violations) {
        console.error('\x1b[31m%s\x1b[0m', `  - ${v.file}: ${v.issue}`);
      }
      if (options.mode === 'scan' || config.strictness === 'warn') {
        console.warn('\x1b[33m%s\x1b[0m', '\n[Design Memory] ⚠️ Warning mode enabled. This result is advisory and does not block workflow.');
        exit(0);
      } else {
        console.warn('\x1b[33m%s\x1b[0m', '\n[Design Memory] ⚠️ Commit blocked. If this is a false positive, force the commit by running: git commit --no-verify');
        exit(1);
      }
    } else {
      console.log('\x1b[32m%s\x1b[0m', '\n[Design Memory] ✅ Design memory verified. Clean commit.');
      exit(0);
    }
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `[Design Memory] Error during audit: ${error instanceof Error ? error.message : String(error)}`);
    exit(1);
  }
}
