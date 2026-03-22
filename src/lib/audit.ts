import { getStagedDiff } from './git';
import { getDesignContext } from './context';
import { detectAvailableBrain, promptBrain } from './engine';

export type AuditViolation = {
  file: string;
  issue: string;
};

export type AuditResult = {
  driftDetected: boolean;
  violations: AuditViolation[];
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

export async function runAudit(deps: AuditDependencies = {}) {
  const getDiff = deps.getDiff ?? getStagedDiff;
  const getContext = deps.getContext ?? getDesignContext;
  const getBrain = deps.getBrain ?? detectAvailableBrain;
  const askBrain = deps.askBrain ?? promptBrain;
  const exit = deps.exit ?? process.exit;

  console.log('\x1b[36m%s\x1b[0m', '[Design Memory] Starting audit...');

  const diff = getDiff();
  if (!diff) {
    console.log('[Design Memory] No staged UI changes detected. Skipping audit.');
    exit(0);
    return;
  }

  const context = await getContext();
  const brain = await getBrain();

  if (!brain) {
    console.error('\x1b[31m%s\x1b[0m', '[Design Memory] Error: No AI brain discovered. Please run Ollama, LM Studio, or set OPENAI_API_KEY / ANTHROPIC_API_KEY.');
    exit(1);
    return;
  }

  console.log(`[Design Memory] Using brain: ${brain.provider}`);
  const { systemPrompt, userPrompt } = buildAuditPrompt(context, diff);

  try {
    const response = await askBrain(brain, systemPrompt, userPrompt);
    const result = parseAuditResult(response);

    if (result.driftDetected) {
      console.error('\x1b[31m%s\x1b[0m', '\n[Design Memory] ❌ Design drift detected:');
      for (const v of result.violations) {
        console.error('\x1b[31m%s\x1b[0m', `  - ${v.file}: ${v.issue}`);
      }
      exit(1);
    } else {
      console.log('\x1b[32m%s\x1b[0m', '\n[Design Memory] ✅ Design memory verified. Clean commit.');
      exit(0);
    }
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `[Design Memory] Error during audit: ${error instanceof Error ? error.message : String(error)}`);
    exit(1);
  }
}
