import Link from "next/link";
import { notFound } from "next/navigation";

import {
  checkLatestPullRequestAction,
  importReferenceAction,
  importSampleReferenceAction,
  importStitchMarkdownAction,
  runAuditForSelectedPullRequestAction,
  syncFigmaReferenceAction,
  uploadStitchMarkdownAction,
  updateProjectAction,
} from "@/app/actions";
import { Surface } from "@/components/ui";
import { hasGitHubAccessToken, listOpenPullRequests } from "@/lib/github";
import { hasFigmaAccessToken } from "@/lib/figma/client";
import { sampleReferenceSnapshot } from "@/lib/sample-reference";
import { getLatestSnapshotBySourceType, getProjectDetails } from "@/lib/store";
import { formatDate, prettyJson } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ status?: string; message?: string }>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const details = getProjectDetails(projectId);
  const hasFigmaToken = hasFigmaAccessToken();
  const hasGitHubToken = hasGitHubAccessToken();
  const stitchSnapshot = details ? getLatestSnapshotBySourceType(projectId, "stitch-design-md") : null;
  const figmaSnapshot = details ? getLatestSnapshotBySourceType(projectId, "figma-api") : null;
  let openPullRequests: Awaited<ReturnType<typeof listOpenPullRequests>> = [];

  if (details) {
    try {
      openPullRequests = await listOpenPullRequests(
        details.project.repoOwner,
        details.project.repoName,
      );
    } catch {
      openPullRequests = [];
    }
  }

  if (!details) {
    notFound();
  }

  const isStitchProject = details.project.referenceProvider === "stitch";
  const activeSnapshot = isStitchProject ? stitchSnapshot ?? details.latestSnapshot : figmaSnapshot ?? details.latestSnapshot;
  const hasReadyReference = isStitchProject ? Boolean(stitchSnapshot) : hasFigmaToken;
  const canRunAudit = hasGitHubToken && hasReadyReference;
  const referenceLabel = isStitchProject ? "Stitch source connected" : "Figma source connected";
  const auditDescription = isStitchProject
    ? "Design Memory will use the latest imported Stitch DESIGN.md reference, inspect the latest open PR in the connected repo, and generate a Fix brief with supporting drift evidence."
    : "Design Memory will sync the latest Figma truth source, inspect the latest open PR in the connected repo, and generate a Fix brief with supporting drift evidence.";
  const snapshotEmptyMessage = isStitchProject
    ? "No Stitch DESIGN.md snapshot yet. Upload or paste a DESIGN.md file above before running a PR audit."
    : "No reference snapshot yet. The normal path is to sync from Figma using the saved file key. Fallback JSON import is still available above if you need it.";

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#05121d,_#020617)] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-sky-200/70">
              Project workspace
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
              {details.project.name}
            </h1>
            <p className="mt-3 text-slate-300">
              {details.project.repoOwner}/{details.project.repoName} · {referenceLabel}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
          >
            Back to dashboard
          </Link>
        </div>

        {resolvedSearchParams?.message ? (
          <div
            className={`rounded-3xl border px-5 py-4 text-sm ${
              resolvedSearchParams.status === "error"
                ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
                : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {resolvedSearchParams.message}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Surface>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              Repository settings
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Connection details
            </h2>
            <form action={updateProjectAction} className="mt-6 space-y-4">
              <input type="hidden" name="projectId" value={details.project.id} />
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Reference provider</span>
                <select
                  name="referenceProvider"
                  defaultValue={details.project.referenceProvider}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400/60"
                >
                  <option value="figma">Figma</option>
                  <option value="stitch">Stitch DESIGN.md</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Figma URL</span>
                <input
                  name="figmaUrl"
                  defaultValue={details.project.figmaUrl ?? ""}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Stitch URL</span>
                <input
                  name="stitchUrl"
                  defaultValue={details.project.stitchUrl ?? ""}
                  placeholder="Optional provenance for Stitch-backed projects"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">GitHub repo URL</span>
                <input
                  name="repoUrl"
                  defaultValue={details.project.repoUrl}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400/60"
                />
              </label>
              <button
                type="submit"
                className="rounded-full bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-100"
              >
                Save project settings
              </button>
            </form>
          </Surface>

          <Surface>
            {isStitchProject ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Stitch reference
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Import the design reference from Stitch
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                      Normal workflow: export or copy the project DESIGN.md from Stitch and
                      import it here. Manual JSON import stays below as a fallback or debug path.
                    </p>
                  </div>
                </div>
                <div className="mt-6 rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-300">
                        Stitch URL{" "}
                        <span className="font-mono text-white">{details.project.stitchUrl ?? "Not set"}</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {hasGitHubToken
                          ? "GitHub token ready."
                          : "GitHub token missing. Save it in Auth settings or set GITHUB_TOKEN / GH_TOKEN / GITHUB_PAT."}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Import a fresh DESIGN.md whenever the Stitch design system changes.
                      </p>
                    </div>
                    <form action={uploadStitchMarkdownAction} className="flex flex-wrap items-center gap-3">
                      <input type="hidden" name="projectId" value={details.project.id} />
                      <input
                        type="file"
                        name="designMarkdown"
                        accept=".md,text/markdown"
                        className="max-w-[220px] text-sm text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-sky-500/15 file:px-4 file:py-2 file:text-sm file:font-medium file:text-sky-100"
                      />
                      <button
                        type="submit"
                        className="rounded-full bg-sky-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-sky-400"
                      >
                        Upload DESIGN.md
                      </button>
                    </form>
                  </div>
                </div>
                <form action={importStitchMarkdownAction} className="mt-4 space-y-4">
                  <input type="hidden" name="projectId" value={details.project.id} />
                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-300">
                      Paste DESIGN.md
                    </span>
                    <textarea
                      name="markdownContent"
                      placeholder="Paste the exported Stitch DESIGN.md contents here..."
                      className="min-h-72 w-full rounded-[28px] border border-white/10 bg-[#020817] px-4 py-4 font-mono text-sm text-slate-200 outline-none transition focus:border-sky-400/60"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-full bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-100"
                  >
                    Import Stitch DESIGN.md
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Figma reference
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Sync the design reference from Figma
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                      Normal workflow: use the saved Figma file key and sync straight from the
                      Figma API. Manual JSON import stays below as a fallback or debug path.
                    </p>
                  </div>
                </div>
                <div className="mt-6 rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-300">
                        Figma URL{" "}
                        <span className="font-mono text-white">{details.project.figmaUrl ?? "Not set"}</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {hasFigmaToken
                          ? "Figma token ready."
                          : "Figma token missing. Save it in Auth settings or set FIGMA_ACCESS_TOKEN."}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {hasGitHubToken
                          ? "GitHub token ready."
                          : "GitHub token missing. Save it in Auth settings or set GITHUB_TOKEN / GH_TOKEN / GITHUB_PAT."}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Parsed file key <span className="font-mono">{details.project.figmaFileKey ?? "Missing"}</span>
                      </p>
                    </div>
                    <form action={syncFigmaReferenceAction}>
                      <input type="hidden" name="projectId" value={details.project.id} />
                      <button
                        type="submit"
                        disabled={!hasFigmaToken}
                        className="rounded-full bg-sky-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-sky-400"
                      >
                        Sync from Figma
                      </button>
                    </form>
                  </div>
                </div>
              </>
            )}

            <div className="mt-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Fallback import
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Use this only when debugging normalization or importing prepared reference
                  payloads.
                </p>
              </div>
              <form action={importSampleReferenceAction}>
                <input type="hidden" name="projectId" value={details.project.id} />
                <button
                  type="submit"
                  className="rounded-full border border-sky-300/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:bg-sky-500/20"
                >
                  Load sample fallback
                </button>
              </form>
            </div>

            <form action={importReferenceAction} className="mt-4 space-y-4">
              <input type="hidden" name="projectId" value={details.project.id} />
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">
                  Paste normalized reference JSON
                </span>
                <textarea
                  name="referenceJson"
                  defaultValue={prettyJson(sampleReferenceSnapshot)}
                  className="min-h-72 w-full rounded-[28px] border border-white/10 bg-[#020817] px-4 py-4 font-mono text-sm text-slate-200 outline-none transition focus:border-sky-400/60"
                />
              </label>
              <button
                type="submit"
                className="rounded-full border border-white/10 bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-100"
              >
                Import fallback snapshot
              </button>
            </form>
          </Surface>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <Surface>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              Reference summary
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              What the current design snapshot contains
            </h2>
            {activeSnapshot ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-sm text-slate-300">
                    Source: {activeSnapshot.sourceType}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Imported {formatDate(activeSnapshot.createdAt)}
                  </p>
                  {activeSnapshot.snapshot.metadata.fileName ? (
                    <p className="mt-1 text-sm text-slate-500">
                      Reference file {activeSnapshot.snapshot.metadata.fileName}
                    </p>
                  ) : null}
                  {activeSnapshot.snapshot.metadata.lastModified ? (
                    <p className="mt-1 text-sm text-slate-500">
                      Last modified{" "}
                      {formatDate(activeSnapshot.snapshot.metadata.lastModified)}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                      Tokens
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {activeSnapshot.snapshot.metadata.tokenCount ??
                        activeSnapshot.snapshot.tokens.length}{" "}
                      extracted token/style references
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-200">
                      {activeSnapshot.snapshot.tokens.map((token) => (
                        <li key={token.name}>
                          {token.name}
                          {token.codeHints?.length ? (
                            <span className="block text-slate-500">
                              {token.codeHints.join(", ")}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                      Components
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {activeSnapshot.snapshot.metadata.componentCount ??
                        activeSnapshot.snapshot.components.length}{" "}
                      extracted reference components
                    </p>
                    <ul className="mt-4 space-y-3 text-sm text-slate-200">
                      {activeSnapshot.snapshot.components.map((component) => (
                        <li key={component.name}>
                          <span className="font-medium text-white">{component.name}</span>
                          <span className="mt-1 block text-slate-500">
                            {(component.variants ?? []).length} variants ·{" "}
                            {(component.states ?? []).length} states
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-6 rounded-3xl border border-dashed border-white/10 p-5 text-slate-300">
                {snapshotEmptyMessage}
              </p>
            )}
          </Surface>

          <Surface>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Review loop</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Check the latest implementation
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {auditDescription}
            </p>
            <form action={checkLatestPullRequestAction} className="mt-6 flex flex-wrap items-end gap-4">
              <input type="hidden" name="projectId" value={details.project.id} />
              <button
                type="submit"
                disabled={!canRunAudit}
                className="rounded-full bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Check latest PR
              </button>
            </form>
            <div className="mt-8 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                Choose PR manually
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Use this when the latest PR is not the one you want or when the default PR has
                no UI-related changes.
              </p>
              {openPullRequests.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {openPullRequests.slice(0, 5).map((pullRequest) => (
                    <form
                      key={pullRequest.number}
                      action={runAuditForSelectedPullRequestAction}
                      className="rounded-2xl border border-white/8 bg-[#020817] p-4"
                    >
                      <input type="hidden" name="projectId" value={details.project.id} />
                      <input type="hidden" name="prNumber" value={pullRequest.number} />
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-white">
                            #{pullRequest.number} · {pullRequest.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Updated {formatDate(pullRequest.updatedAt)}
                          </p>
                        </div>
                        <button
                          type="submit"
                          className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/5"
                        >
                          Analyze this PR
                        </button>
                      </div>
                    </form>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  No open PRs found or GitHub PR lookup is unavailable right now.
                </p>
              )}
              <form action={runAuditForSelectedPullRequestAction} className="mt-4 flex flex-wrap items-end gap-4">
                <input type="hidden" name="projectId" value={details.project.id} />
                <label className="block max-w-[220px] flex-1">
                  <span className="mb-2 block text-sm text-slate-300">PR number fallback</span>
                  <input
                    name="prNumber"
                    type="number"
                    min={1}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400/60"
                    placeholder="42"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full border border-white/10 bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-100"
                >
                  Choose PR manually
                </button>
              </form>
            </div>
            <div className="mt-8">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                Last checked PR
              </p>
              <div className="mt-4 space-y-3">
                {details.auditRuns.length === 0 ? (
                  <p className="rounded-3xl border border-dashed border-white/10 p-5 text-slate-300">
                    No audits yet for this project.
                  </p>
                ) : null}
                {details.auditRuns.map((run) => (
                  <Link
                    key={run.id}
                    href={`/audits/${run.id}`}
                    className="block rounded-3xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-sky-300/30 hover:bg-white/[0.05]"
                  >
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                      {formatDate(run.createdAt)}
                    </p>
                    <h3 className="mt-2 text-lg font-medium text-white">
                      {run.prSelectionMode === "auto-latest" ? "Latest PR" : "Manual PR"} · #
                      {run.prNumber} · {run.prTitle}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {run.summary.totalIssues} issues · {run.summary.high} high ·{" "}
                      {run.summary.medium} medium · {run.summary.low} low
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Reference: {run.referenceSnapshotSourceType ?? "unknown"} · {run.referenceSyncMode === "cached" ? "cached fallback" : run.referenceSyncMode === "live" ? "live sync" : "unknown mode"}
                    </p>
                    {run.sourcePrUpdatedAt ? (
                      <p className="mt-1 text-sm text-slate-500">
                        PR updated {formatDate(run.sourcePrUpdatedAt)}
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </main>
  );
}
