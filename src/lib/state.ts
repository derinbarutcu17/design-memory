import fs from 'node:fs';
import path from 'node:path';

import { getStateDir, readConfig } from './config';
import type { AuditRun, BaselineStore, IssueReview, ReferenceSnapshot, ReviewStore } from './types';
import { makeId } from './utils';

type Paths = {
  root: string;
  referenceSnapshot: string;
  latestRun: string;
  reviews: string;
  baseline: string;
  runsDir: string;
};

function getPaths(cwd = process.cwd()): Paths {
  const config = readConfig(cwd);
  const root = getStateDir(cwd, config);
  return {
    root,
    referenceSnapshot: path.join(root, 'reference-snapshot.json'),
    latestRun: path.join(root, 'latest-run.json'),
    reviews: path.join(root, 'reviews.json'),
    baseline: path.join(root, 'baseline.json'),
    runsDir: path.join(root, 'runs'),
  };
}

function ensureDir(target: string) {
  fs.mkdirSync(target, { recursive: true });
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJsonFile(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function ensureState(cwd = process.cwd()) {
  const paths = getPaths(cwd);
  ensureDir(paths.root);
  ensureDir(paths.runsDir);
  return paths;
}

export function saveReferenceSnapshot(snapshot: ReferenceSnapshot, cwd = process.cwd()) {
  const paths = ensureState(cwd);
  writeJsonFile(paths.referenceSnapshot, snapshot);
  return paths.referenceSnapshot;
}

export function loadReferenceSnapshot(cwd = process.cwd()) {
  const paths = getPaths(cwd);
  return readJsonFile<ReferenceSnapshot>(paths.referenceSnapshot);
}

export function saveAuditRun(run: AuditRun, cwd = process.cwd()) {
  const paths = ensureState(cwd);
  writeJsonFile(paths.latestRun, run);
  const safeDate = run.createdAt.replace(/[:.]/g, '-');
  writeJsonFile(path.join(paths.runsDir, `${safeDate}-${run.id}.json`), run);
}

export function loadLatestRun(cwd = process.cwd()) {
  const paths = getPaths(cwd);
  return readJsonFile<AuditRun>(paths.latestRun);
}

export function loadRunHistory(cwd = process.cwd()) {
  const paths = getPaths(cwd);
  if (!fs.existsSync(paths.runsDir)) {
    return [];
  }

  return fs.readdirSync(paths.runsDir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => readJsonFile<AuditRun>(path.join(paths.runsDir, entry)))
    .filter((entry): entry is AuditRun => Boolean(entry))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function loadReviews(cwd = process.cwd()): ReviewStore {
  const paths = getPaths(cwd);
  return readJsonFile<ReviewStore>(paths.reviews) ?? { reviews: {} };
}

export function saveReview(review: Omit<IssueReview, 'createdAt' | 'updatedAt'>, cwd = process.cwd()) {
  const current = loadReviews(cwd);
  const existing = current.reviews[review.fingerprint];
  const now = new Date().toISOString();
  current.reviews[review.fingerprint] = {
    ...review,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const paths = ensureState(cwd);
  writeJsonFile(paths.reviews, current);
  return current.reviews[review.fingerprint];
}

export function loadBaseline(cwd = process.cwd()) {
  const paths = getPaths(cwd);
  return readJsonFile<BaselineStore>(paths.baseline);
}

export function createBaseline(fingerprints: string[], cwd = process.cwd()) {
  const baseline: BaselineStore = {
    acceptedFingerprints: Object.fromEntries(fingerprints.map((fingerprint) => [fingerprint, fingerprint])),
    createdAt: new Date().toISOString(),
  };
  const paths = ensureState(cwd);
  writeJsonFile(paths.baseline, baseline);
  return baseline;
}

export function makeRunId() {
  return makeId('run');
}
