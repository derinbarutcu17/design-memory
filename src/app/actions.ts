"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { analyzeDrift, generateCheckSummary, generateFixBrief } from "@/lib/audit";
import { FigmaSyncError } from "@/lib/figma/client";
import { syncReferenceSnapshotFromFigma } from "@/lib/figma/normalize-reference";
import {
  fetchLatestOpenPullRequest,
  fetchPullRequest,
  postPullRequestComment,
} from "@/lib/github";
import { createProjectSchema, referenceSnapshotSchema } from "@/lib/schema";
import { sampleReferenceSnapshot } from "@/lib/sample-reference";
import { normalizeStitchReference } from "@/lib/stitch/normalize";
import {
  buildInheritedReviews,
  createAuditRun,
  createProject,
  createReferenceSnapshot,
  getAuditRun,
  getLatestSnapshotBySourceType,
  getProjectDetails,
  listAuditRuns,
  listIssuesForAuditRun,
  listReviewsForAuditRun,
  upsertIssueReview,
  updateProject,
} from "@/lib/store";
import { setSecureCredential } from "@/lib/secure-credentials";
import type { ReviewStatus } from "@/lib/types";
import { ensureOptionalUrl, makeId, parseFigmaUrl, parseGitHubRepoUrl } from "@/lib/utils";

function homeMessageRedirect(status: "success" | "error", message: string) {
  const query = new URLSearchParams({ status, message });
  redirect(`/?${query.toString()}`);
}

function projectMessageRedirect(projectId: string, status: "success" | "error", message: string) {
  const query = new URLSearchParams({ status, message });
  redirect(`/projects/${projectId}?${query.toString()}`);
}

function rethrowIfRedirectError(error: unknown) {
  if (isRedirectError(error)) {
    throw error;
  }
}

export async function createProjectAction(formData: FormData) {
  try {
    const parsed = createProjectSchema.parse({
      name: formData.get("name"),
      referenceProvider: formData.get("referenceProvider"),
      figmaUrl: formData.get("figmaUrl"),
      stitchUrl: formData.get("stitchUrl"),
      repoUrl: formData.get("repoUrl"),
    });
    const { owner, repo } = parseGitHubRepoUrl(parsed.repoUrl);
    const figmaFileKey =
      parsed.referenceProvider === "figma" && parsed.figmaUrl
        ? parseFigmaUrl(parsed.figmaUrl).figmaFileKey
        : undefined;
    const stitchUrl = ensureOptionalUrl(parsed.stitchUrl ?? "");

    const project = createProject({
      name: parsed.name,
      referenceProvider: parsed.referenceProvider,
      figmaUrl: parsed.figmaUrl,
      stitchUrl,
      repoUrl: parsed.repoUrl,
      figmaFileKey,
      repoOwner: owner,
      repoName: repo,
    });
    revalidatePath("/");
    redirect(`/projects/${project.id}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : "Project creation failed.";
    homeMessageRedirect("error", message);
  }
}

export async function updateProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  try {
    const referenceProvider = String(formData.get("referenceProvider")) as "figma" | "stitch";
    const rawFigmaUrl = String(formData.get("figmaUrl"));
    const rawStitchUrl = String(formData.get("stitchUrl"));
    const rawRepoUrl = String(formData.get("repoUrl"));
    const { owner, repo } = parseGitHubRepoUrl(rawRepoUrl);
    const figmaFileKey =
      referenceProvider === "figma" && rawFigmaUrl.trim()
        ? parseFigmaUrl(rawFigmaUrl).figmaFileKey
        : undefined;
    const stitchUrl = ensureOptionalUrl(rawStitchUrl);

    updateProject(projectId, {
      referenceProvider,
      figmaUrl: rawFigmaUrl,
      stitchUrl,
      repoUrl: rawRepoUrl,
      figmaFileKey,
      repoOwner: owner,
      repoName: repo,
    });
    revalidatePath(`/projects/${projectId}`);
    projectMessageRedirect(projectId, "success", "Connection details updated.");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : "Connection update failed.";
    projectMessageRedirect(projectId, "error", message);
  }
}

export async function saveAuthSettingsAction(formData: FormData) {
  try {
    const figmaToken = String(formData.get("figmaToken") ?? "").trim();
    const githubToken = String(formData.get("githubToken") ?? "").trim();

    if (figmaToken) {
      setSecureCredential("figma_access_token", figmaToken);
    }

    if (githubToken) {
      setSecureCredential("github_token", githubToken);
    }

    revalidatePath("/");
    redirect("/?status=success&message=Auth%20settings%20saved%20locally.");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : "Could not save auth settings.";
    homeMessageRedirect("error", message);
  }
}

export async function importReferenceAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  try {
    const rawReference = String(formData.get("referenceJson"));
    const parsed = referenceSnapshotSchema.parse(JSON.parse(rawReference));
    createReferenceSnapshot(projectId, parsed);
    revalidatePath(`/projects/${projectId}`);
    projectMessageRedirect(projectId, "success", "Fallback reference snapshot imported.");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : "Manual import failed.";
    projectMessageRedirect(projectId, "error", message);
  }
}

export async function importSampleReferenceAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  createReferenceSnapshot(projectId, sampleReferenceSnapshot);
  revalidatePath(`/projects/${projectId}`);
  projectMessageRedirect(projectId, "success", "Sample fallback reference loaded.");
}

export async function syncFigmaReferenceAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const details = getProjectDetails(projectId);

  if (!details) {
    throw new Error("Project not found.");
  }

  try {
    if (details.project.referenceProvider !== "figma" || !details.project.figmaFileKey) {
      throw new Error("This project is not configured for Figma sync.");
    }

    const snapshot = await syncReferenceSnapshotFromFigma(details.project.figmaFileKey);
    createReferenceSnapshot(projectId, snapshot);
    revalidatePath(`/projects/${projectId}`);
    projectMessageRedirect(
      projectId,
      "success",
      `Synced ${snapshot.metadata.componentCount ?? 0} components from Figma.`,
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : "Figma sync failed.";
    projectMessageRedirect(projectId, "error", message);
  }
}

export async function importStitchMarkdownAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const details = getProjectDetails(projectId);

  if (!details) {
    throw new Error("Project not found.");
  }

  try {
    const markdownContent = String(formData.get("markdownContent") ?? "");
    const snapshot = normalizeStitchReference(markdownContent, {
      stitchUrl: details.project.stitchUrl,
    });
    createReferenceSnapshot(projectId, snapshot);
    revalidatePath(`/projects/${projectId}`);
    projectMessageRedirect(
      projectId,
      "success",
      `Imported ${snapshot.metadata.tokenCount ?? 0} tokens from Stitch DESIGN.md.`,
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : "Stitch markdown import failed.";
    projectMessageRedirect(projectId, "error", message);
  }
}

export async function uploadStitchMarkdownAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const details = getProjectDetails(projectId);

  if (!details) {
    throw new Error("Project not found.");
  }

  try {
    const file = formData.get("designMarkdown");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Choose a DESIGN.md file to upload.");
    }

    const snapshot = normalizeStitchReference(await file.text(), {
      fileName: file.name || "DESIGN.md",
      stitchUrl: details.project.stitchUrl,
    });
    createReferenceSnapshot(projectId, snapshot);
    revalidatePath(`/projects/${projectId}`);
    projectMessageRedirect(
      projectId,
      "success",
      `Imported ${snapshot.metadata.tokenCount ?? 0} tokens from ${file.name || "DESIGN.md"}.`,
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : "Stitch upload failed.";
    projectMessageRedirect(projectId, "error", message);
  }
}

async function resolveAuditReferenceSnapshot(
  projectId: string,
  project: { referenceProvider: "figma" | "stitch"; figmaFileKey?: string },
) {
  if (project.referenceProvider === "stitch") {
    const cachedSnapshot = getLatestSnapshotBySourceType(projectId, "stitch-design-md");
    if (cachedSnapshot) {
      return {
        snapshotRecord: cachedSnapshot,
        referenceSyncMode: "cached" as const,
      };
    }

    throw new Error("Import a Stitch DESIGN.md reference before running a PR audit.");
  }

  if (!project.figmaFileKey) {
    throw new Error("This Figma-backed project is missing a Figma file key.");
  }

  try {
    const snapshot = await syncReferenceSnapshotFromFigma(project.figmaFileKey);
    return {
      snapshotRecord: createReferenceSnapshot(projectId, snapshot),
      referenceSyncMode: "live" as const,
    };
  } catch (error) {
    if (error instanceof FigmaSyncError && error.status === 429) {
      const cachedSnapshot = getLatestSnapshotBySourceType(projectId, "figma-api");
      if (cachedSnapshot) {
        return {
          snapshotRecord: cachedSnapshot,
          referenceSyncMode: "cached" as const,
        };
      }
    }

    throw error;
  }
}

async function runAuditForPullRequest(
  projectId: string,
  prNumber: number,
  prSelectionMode: "auto-latest" | "manual",
) {
  const details = getProjectDetails(projectId);

  if (!details) {
    throw new Error("Project not found.");
  }

  const latestSnapshotResult = await resolveAuditReferenceSnapshot(
    projectId,
    details.project,
  );
  const pr = await fetchPullRequest(details.project.repoOwner, details.project.repoName, prNumber);

  if (pr.files.length === 0) {
    throw new Error("No UI-related changes found in that pull request.");
  }

  const previousRun = listAuditRuns(projectId)[0];
  const previousIssues = previousRun ? listIssuesForAuditRun(previousRun.id) : [];
  const previousReviews = previousRun
    ? listReviewsForAuditRun(previousRun.id).map((review) => ({
        fingerprint: review.fingerprint,
        status: review.status,
      }))
    : [];

  const pendingRunId = makeId("run");
  const analysis = analyzeDrift(pendingRunId, latestSnapshotResult.snapshotRecord.snapshot, pr, {
    issues: previousIssues,
    reviews: previousReviews,
    runId: previousRun?.id,
  });

  const inheritedReviews = buildInheritedReviews(
    previousRun?.id,
    analysis.carriedStatuses.map((review) => review.fingerprint),
  );

  const run = createAuditRun(
    {
      projectId,
      referenceSnapshotId: latestSnapshotResult.snapshotRecord.id,
      referenceSyncMode: latestSnapshotResult.referenceSyncMode,
      referenceSnapshotSourceType: latestSnapshotResult.snapshotRecord.sourceType,
      prNumber,
      prTitle: pr.title,
      commitSha: pr.headSha,
      sourcePrUrl: pr.url,
      sourcePrUpdatedAt: pr.updatedAt,
      prSelectionMode,
      status: "completed",
      summary: analysis.summary,
      comparison: analysis.comparison,
    },
    analysis.issues.map((issue) => ({ ...issue, auditRunId: pendingRunId })),
    inheritedReviews,
  );

  revalidatePath(`/projects/${projectId}`);
  redirect(`/audits/${run.id}`);
}

export async function checkLatestPullRequestAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const details = getProjectDetails(projectId);

  if (!details) {
    throw new Error("Project not found.");
  }

  try {
    const latestOpenPr = await fetchLatestOpenPullRequest(
      details.project.repoOwner,
      details.project.repoName,
    );

    if (!latestOpenPr) {
      projectMessageRedirect(
        projectId,
        "error",
        "No open PRs found. Choose a PR manually to keep going.",
      );
    }

    await runAuditForPullRequest(projectId, latestOpenPr.number, "auto-latest");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message =
      error instanceof Error ? error.message : "Could not check the latest pull request.";
    projectMessageRedirect(projectId, "error", message);
  }
}

export async function runAuditForSelectedPullRequestAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const prNumber = Number(formData.get("prNumber"));

  try {
    await runAuditForPullRequest(projectId, prNumber, "manual");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : "Could not run the selected PR.";
    projectMessageRedirect(projectId, "error", message);
  }
}

export async function runAuditAction(formData: FormData) {
  return runAuditForSelectedPullRequestAction(formData);
}

export async function reviewIssueAction(formData: FormData) {
  const auditRunId = String(formData.get("auditRunId"));
  const fingerprint = String(formData.get("fingerprint"));
  const status = String(formData.get("status")) as ReviewStatus;

  upsertIssueReview(auditRunId, fingerprint, status);
  const auditRun = getAuditRun(auditRunId);

  revalidatePath(`/audits/${auditRunId}`);
  if (auditRun) {
    revalidatePath(`/projects/${auditRun.projectId}`);
  }
}

export async function exportGitHubCommentAction(formData: FormData) {
  const auditRunId = String(formData.get("auditRunId"));
  const auditRun = getAuditRun(auditRunId);

  if (!auditRun) {
    throw new Error("Audit run not found.");
  }

  const details = getProjectDetails(auditRun.projectId);
  if (!details) {
    throw new Error("Project not found.");
  }

  const issues = listIssuesForAuditRun(auditRunId);
  const reviews = new Map(listReviewsForAuditRun(auditRunId).map((review) => [review.fingerprint, review.status]));
  const pr = {
    number: auditRun.prNumber,
    title: auditRun.prTitle,
    headSha: auditRun.commitSha,
    url: auditRun.sourcePrUrl ?? `https://github.com/${details.project.repoOwner}/${details.project.repoName}/pull/${auditRun.prNumber}`,
    files: [],
  };
  const fixBrief = generateFixBrief(pr, issues, reviews);
  const checkSummary = generateCheckSummary(pr, issues, reviews);
  const commentBody = [
    `## Design Memory check`,
    ``,
    `Summary`,
    '```',
    checkSummary,
    '```',
    ``,
    `Fix brief`,
    '```',
    fixBrief,
    '```',
  ].join("\n");

  try {
    await postPullRequestComment(details.project.repoOwner, details.project.repoName, auditRun.prNumber, commentBody);
    projectMessageRedirect(details.project.id, "success", "Posted summary and Fix brief to GitHub.");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : "Could not post to GitHub.";
    projectMessageRedirect(details.project.id, "error", message);
  }
}
