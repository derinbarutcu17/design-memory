# Design Memory

Design Memory is a local-first design-to-code audit tool.

It compares a Figma reference against a GitHub pull request and spots where implementation drifted.

The point is simple:
keep the code matching the design, and turn the gap into a Fix Brief an agent can act on.

## What it does

- syncs a Figma reference for a project
- checks the latest PR or a manually chosen PR
- detects design drift
- generates an agent-ready Fix Brief
- supports GitHub PR review and export workflows
- stays local-first instead of making GitHub or Figma the source of truth

## What it checks

- token mismatches
- hardcoded styles
- variant drift
- missing states
- broken spacing and layout consistency
- obvious shared-component reuse misses

## Workflow

1. Create a project with a Figma URL and a GitHub repo URL.
2. Sync the design reference from Figma.
3. Pick the PR to review.
4. Review drift issues and the Fix Brief.
5. Paste the Fix Brief into your coding agent.
6. Re-run the check after fixes.

## Output

Design Memory gives you:

- a drift report
- a Fix Brief written for an agent
- review status for each issue
- a clean loop for re-checking after code changes

## Setup

Create `.env.local` in the project root:

```bash
FIGMA_ACCESS_TOKEN=***
```

GitHub access comes from your local `gh` login.

Check auth:

```bash
gh auth status
```

Install and run:

```bash
npm install
npm run dev
```

## Notes

- Figma sync needs a valid access token.
- Manual JSON import exists as a fallback.
- The app is built to stay local-first and keep drift detection fast.
