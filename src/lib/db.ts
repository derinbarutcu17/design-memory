import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const storageDir = path.join(process.cwd(), "storage");
const dbPath = path.join(storageDir, "design-memory.db");

function ensureDatabase() {
  fs.mkdirSync(storageDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      repo_owner TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      figma_file_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reference_snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version_label TEXT NOT NULL,
      source_type TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      reference_snapshot_id TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      pr_title TEXT NOT NULL,
      commit_sha TEXT NOT NULL,
      status TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      comparison_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drift_issues (
      id TEXT PRIMARY KEY,
      audit_run_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      component_name TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      confidence REAL NOT NULL,
      expected TEXT NOT NULL,
      found TEXT NOT NULL,
      file_path TEXT NOT NULL,
      evidence_snippet TEXT NOT NULL,
      suggested_action TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issue_reviews (
      id TEXT PRIMARY KEY,
      audit_run_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return db;
}

const globalForDb = globalThis as typeof globalThis & {
  designMemoryDb?: Database.Database;
};

export const db = globalForDb.designMemoryDb ?? ensureDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDb.designMemoryDb = db;
}
