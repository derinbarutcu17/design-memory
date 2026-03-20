import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const storageDir = path.join(process.cwd(), "storage");
const dbPath = path.join(storageDir, "design-memory.db");
const migrationsDir = path.join(process.cwd(), "migrations");

type MigrationFile = {
  version: number;
  filename: string;
  path: string;
};

function tableColumns(db: Database.Database, table: string) {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
}

function columnExists(db: Database.Database, table: string, column: string) {
  return tableColumns(db, table).some((entry) => entry.name === column);
}

function splitSqlStatements(sql: string) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function runMigrationSql(db: Database.Database, sql: string) {
  for (const statement of splitSqlStatements(sql)) {
    const alterMatch = statement.match(/^ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)\b/i);
    if (alterMatch) {
      const [, table, column] = alterMatch;
      if (columnExists(db, table, column)) {
        continue;
      }
    }

    db.exec(`${statement};`);
  }
}

function listMigrations(): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((filename) => /^\d+_.+\.sql$/.test(filename))
    .map((filename) => ({
      filename,
      version: Number(filename.slice(0, 3)),
      path: path.join(migrationsDir, filename),
    }))
    .sort((left, right) => left.version - right.version);
}

function ensureDatabase() {
  fs.mkdirSync(storageDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const currentVersion = Number(
    db.pragma("user_version", { simple: true }) ?? 0,
  );

  for (const migration of listMigrations()) {
    if (migration.version <= currentVersion) {
      continue;
    }

    const sql = fs.readFileSync(migration.path, "utf8");
    db.transaction(() => {
      runMigrationSql(db, sql);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }

  return db;
}

const globalForDb = globalThis as typeof globalThis & {
  designMemoryDb?: Database.Database;
};

export const db = globalForDb.designMemoryDb ?? ensureDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDb.designMemoryDb = db;
}
