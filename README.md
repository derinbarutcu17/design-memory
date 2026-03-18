# Design Memory

Design Memory is a Figma-first design-to-code drift review workflow.

V1 is intentionally narrow:

- Figma reference import via normalized Figma-derived JSON
- GitHub PR ingestion through the local authenticated `gh` CLI
- Deterministic drift detection for React/Next + Tailwind-style UI code
- Human review statuses for each issue
- Fix brief export for a coding agent
- Rerun comparison using stable issue fingerprints

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS 4
- SQLite via `better-sqlite3`
- GitHub access via `gh api`

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## GitHub requirements

This app expects the GitHub CLI to be installed and authenticated locally:

```bash
gh auth status
```

The server-side GitHub client calls `gh api` to fetch:

- pull request metadata
- changed UI files
- patches
- current file contents

## Figma reference input

V1 does not promise live Figma API sync. Instead, it accepts a normalized JSON payload derived from Figma export data.

The app includes a sample `Button` / `Input` / `Card` reference payload you can load from the project page.

Expected top-level shape:

```json
{
  "metadata": {
    "source": "figma-export",
    "versionLabel": "Demo system v1",
    "figmaFileKey": "DM-V1-DEMO"
  },
  "tokens": [],
  "components": []
}
```

Each component can define:

- `codeMatches`
- `requiredPatterns`
- `disallowedPatterns`
- `variants`
- `states`

## Supported drift checks

- `token-mismatch`
- `hardcoded-style`
- `variant-drift`
- `missing-state`
- `component-reuse` as a low-confidence heuristic only

## Current limitations

- Single-user, local-first only
- No background jobs or GitHub Actions
- No live AI suggestions
- No screenshot diffing
- Best signal comes from shared component files that use common Tailwind or `cva` patterns

## Demo flow

1. Create a project with repo owner, repo name, and Figma file key.
2. Load the sample reference or paste your normalized reference JSON.
3. Run a PR audit.
4. Review issues and mark them `valid`, `intentional`, or `ignore`.
5. Copy the generated fix brief.
6. Re-run after changes and review the comparison page.
