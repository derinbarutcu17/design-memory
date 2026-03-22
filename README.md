# @derin/design-memory

Headless CLI for design drift enforcement in code and agent workflows.

This README is written so a coding agent can pick up this repository, install the tool, attach it to another repository, and run a real audit flow with minimal guessing.

## What This Tool Does

- audits staged UI changes with `git diff --cached`
- reads design context from `DESIGN.md` or `design.md`
- reads project rules from `.cursorrules` when present
- reads optional Figma token context from `design-memory.config.json`
- prefers local model endpoints before paid APIs
- supports blocking hook mode and warning-only mode
- supports non-blocking GitHub PR scans with `gh`

## Repo Architecture

- `src/cli/index.ts`: CLI entrypoint
- `src/cli/install.ts`: installs `.git/hooks/pre-commit` and writes config
- `src/cli/ghost.ts`: injects AI usage rules into `.cursorrules` / `.windsurfrules`
- `src/lib/git.ts`: harvests staged UI diffs and filters non-UI files
- `src/lib/context.ts`: loads design context from repo files
- `src/lib/config.ts`: canonical config schema and file filtering
- `src/lib/engine.ts`: local-first model routing
- `src/lib/audit.ts`: deterministic + LLM audit logic
- `src/lib/github.ts`: `gh`-based PR scanning

## Install For Local Development

From this repository:

```bash
cd /Users/derin/Desktop/CODING/design-memory
npm install
npm run build
npm link
```

Verify the CLI:

```bash
design-memory --help
```

## Quickstart In Another Repository

From the target repository you want to audit:

```bash
cd /path/to/target-repo
npx @derin/design-memory init
npx @derin/design-memory ghost
```

This creates:

- `.git/hooks/pre-commit`
- `design-memory.config.json`
- `.cursorrules` if no rules file exists

## Canonical Config

`design-memory init` writes this file if it does not exist:

```json
{
  "strictness": "warn",
  "designSource": "./DESIGN.md",
  "include": ["src/components/**/*.tsx", "src/app/**/*.tsx"],
  "exclude": ["src/lib/**", "**/*.test.tsx", "**/*.test.ts"],
  "ai": {
    "providerPreference": ["local", "anthropic", "openai"],
    "maxRetries": 1
  }
}
```

## Minimal Design File

Create `DESIGN.md` or `design.md` in the target repository root.

Example:

```md
# UI Rules

Use only approved color tokens.
Do not use raw hex colors in UI components.
Use rounded corners for interactive elements.
Spacing must follow the design token scale.
```

## How An Agent Should Use It

If the user gives you a repository and says “let’s use Design Memory,” do this:

1. Clone or open the target repository.
2. Run `npx @derin/design-memory init`.
3. Run `npx @derin/design-memory ghost`.
4. Ensure the repo contains `DESIGN.md` or update `design-memory.config.json` to point at the correct design file.
5. Stage UI changes with `git add .` or `git add <files>`.
6. Run `npx @derin/design-memory audit`.
7. If drift is reported:
   - read the violations
   - fix them
   - rerun `npx @derin/design-memory audit`
8. Commit only after the audit is clean, or let the user decide to bypass with `git commit --no-verify`.

## Manual Audit Flow

```bash
git add .
npx @derin/design-memory audit
```

Behavior:

- no staged UI changes: exits clean
- clean audit: exits `0`
- drift in `warn` mode: prints violations and exits `0`
- drift in `block` mode: prints violations, prints `git commit --no-verify`, exits `1`

## Git Hook Flow

After `design-memory init`, commits trigger the audit automatically:

```bash
git commit -m "Update button styles"
```

If `strictness` is `"block"` and drift is found, the hook prints:

```bash
git commit --no-verify
```

That is the emergency escape hatch for false positives.

## PR Scan Flow

Non-blocking review of an existing GitHub PR:

```bash
npx @derin/design-memory scan --pr=123
```

Requirements:

- target repo must be a Git repo
- `gh` CLI must be installed and authenticated

The scan command uses the local GitHub CLI, not Octokit.

## Model Routing

Provider preference is controlled by `design-memory.config.json`.

Default:

```json
{
  "ai": {
    "providerPreference": ["local", "anthropic", "openai"]
  }
}
```

Resolution order:

1. Ollama on `localhost:11434`
2. LM Studio on `localhost:1234`
3. `ANTHROPIC_API_KEY` if preferred and available
4. `OPENAI_API_KEY` if preferred and available

## Deterministic Anchoring

Before the LLM is asked to judge structural drift, the audit runs deterministic checks:

- extracts raw hex colors from the diff
- compares them to the allowed hex values found in the design context
- injects these findings into the prompt as `DETERMINISTIC FACTS:`

This reduces hallucinated token violations.

## CLI Commands

```bash
npx @derin/design-memory init
npx @derin/design-memory audit
npx @derin/design-memory scan --pr=123
npx @derin/design-memory ghost
```

## JSON Schemas

### Audit Result Schema

```json
{
  "driftDetected": true,
  "violations": [
    {
      "file": "components/Button.tsx",
      "issue": "Hardcoded hex color does not match design.md token rules."
    }
  ]
}
```

### MCP Tool Input Schema

```json
{
  "type": "object",
  "properties": {
    "cwd": {
      "type": "string",
      "description": "Absolute repository path to audit. Defaults to the current working directory."
    },
    "mode": {
      "type": "string",
      "enum": ["staged"],
      "description": "Audit mode. Only staged changes are supported."
    }
  },
  "required": [],
  "additionalProperties": false
}
```

## MCP / Skill Integration

- tool name: `design_memory_audit`
- execution command: `npx @derin/design-memory audit`

## Verification Commands

Run inside this repository:

```bash
npm run build
npm test
npm run lint
npm pack --dry-run
```

## Agent Shortcut

If you are an agent and the user says “use Design Memory on this repo,” the minimum safe command sequence is:

```bash
cd /path/to/target-repo
npx @derin/design-memory init
npx @derin/design-memory ghost
git add .
npx @derin/design-memory audit
```
