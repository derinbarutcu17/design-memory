# Design Memory

Design Memory is a local-first design-to-code audit tool.

It compares a design reference against a GitHub pull request and points out where the implementation drifted.

Supported reference providers:

- Figma
- Stitch `DESIGN.md`

The point is simple:
keep the code matching the design, and turn the gap into a Fix Brief an agent can act on.

## What it does

- syncs a Figma reference for a project
- imports and stores Stitch `DESIGN.md` reference snapshots
- checks the latest PR or a manually chosen PR
- detects design drift
- generates an agent-ready Fix Brief
- supports GitHub PR review and export workflows
- stays local-first instead of making GitHub or the design provider the source of truth

## What it checks

- token mismatches
- hardcoded styles
- variant drift
- missing states
- broken spacing and layout consistency
- obvious shared-component reuse misses

## Workflow

1. Create a project with either a Figma URL or Stitch as the reference provider plus a GitHub repo URL.
2. Sync the design reference from Figma, or import a Stitch `DESIGN.md`.
3. Check the latest open PR, or choose one manually.
4. Review drift issues and the Fix Brief.
5. Paste the Fix Brief into your coding agent.
6. Re-run the check after fixes.

## Output

Design Memory gives you:

- a drift report
- a Fix Brief written for an agent
- review status for each issue
- a clean loop for re-checking after code changes

## What it stores

- project links and parsed IDs
- synced reference snapshots from Figma or Stitch
- audit runs
- detected issues
- review status for each issue

## Setup

Create `.env.local` in the project root if you want Figma-backed projects:

```bash
FIGMA_ACCESS_TOKEN=your_token_here
```

GitHub access comes from your saved app token or from `GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_PAT`.

You can also check your GitHub CLI login:

```bash
gh auth status
```

Install and run:

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal.

## Running the app

- Use the dashboard to create a project.
- Choose `Figma` or `Stitch DESIGN.md` as the reference provider.
- Add the matching reference details and a GitHub repo URL.
- For Figma projects, sync from Figma.
- For Stitch projects, upload or paste `DESIGN.md`.
- Run a PR check.
- Review the Fix Brief and drift evidence.

## Notes

- Figma sync needs a valid access token.
- Stitch projects use stored `DESIGN.md` snapshots during audits.
- Manual JSON import exists as a fallback, not the main path.
- The app is built to stay local-first and keep GitHub plus a design reference provider as connected inputs, not source-of-truth copies.
- Live Stitch SDK and Stitch MCP sync are intentionally deferred; the first Stitch path is `DESIGN.md` import.
