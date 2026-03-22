# @derin/design-memory

Zero-latency headless design enforcer.

## System Architecture
Pure TypeScript CLI binary. No frontend. No database. Pure logic.
- **Git Harvester:** Extracts staged changes via `git diff --cached`.
- **Design Context:** Aggregates ground truth from `design.md`, `.cursorrules`, and Figma tokens.
- **LLM Engine:** Multi-provider brain (Ollama, LM Studio, OpenAI, Anthropic).
- **Audit Executioner:** Validates diffs against context and blocks non-compliant commits.

## Execution Flow
1. **init:** Installs Git pre-commit hook.
2. **audit:** Manually triggers design drift analysis.
3. **ghost:** Injects design enforcement rules into IDE AI instructions.
4. **scan:** Runs a non-blocking audit against an existing GitHub pull request.

## Canonical Config

`init` writes `design-memory.config.json` if it does not already exist:

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

## MCP / Skill Integration
Natively compatible with Model Context Protocol (MCP).
- **Tool Name:** `design_memory_audit`
- **Command:** `npx @derin/design-memory audit`

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

## CLI Commands
- `npx @derin/design-memory init`: Setup the Git hook.
- `npx @derin/design-memory audit`: Manually check staged files.
- `npx @derin/design-memory scan --pr=123`: Audit a PR without blocking anything.
- `npx @derin/design-memory ghost`: Configure IDE AI constraints.

## LLM Integration Instructions
When asked to verify design or review UI code:
1. Stage your changes: `git add .`
2. Execute: `npx @derin/design-memory audit`
3. If drift is detected, fix the violations before attempting to commit.
4. Before generating code, always cross-reference `design.md`.
