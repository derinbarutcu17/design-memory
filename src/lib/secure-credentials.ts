import fs from "node:fs";
import path from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { db } from "@/lib/db";

const STORAGE_DIR = path.join(process.cwd(), "storage");
const MASTER_KEY_PATH = path.join(STORAGE_DIR, "design-memory-master.key");

export type SecureCredentialName = "figma_access_token" | "github_token";

function ensureStorageDir() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function deriveKeyFromString(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest();
}

function readOrCreateMasterKey() {
  const envKey = process.env.DESIGN_MEMORY_MASTER_KEY ?? process.env.DESIGN_MEMORY_SECRET_KEY;
  if (envKey) {
    return deriveKeyFromString(envKey);
  }

  ensureStorageDir();
  if (!fs.existsSync(MASTER_KEY_PATH)) {
    const generated = randomBytes(32).toString("base64");
    fs.writeFileSync(MASTER_KEY_PATH, generated, { mode: 0o600 });
  }

  const stored = fs.readFileSync(MASTER_KEY_PATH, "utf8").trim();
  const key = Buffer.from(stored, "base64");
  if (key.length !== 32) {
    throw new Error("Invalid local master key. Delete storage/design-memory-master.key and restart.");
  }

  return key;
}

function encryptValue(value: string) {
  const key = readOrCreateMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    encryptedValue: encrypted.toString("base64"),
  };
}

function decryptValue(payload: { iv: string; authTag: string; encryptedValue: string }) {
  const key = readOrCreateMasterKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedValue, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function getSecureCredential(name: SecureCredentialName) {
  const row = db
    .prepare(
      `SELECT iv, auth_tag, encrypted_value
       FROM secure_credentials
       WHERE name = ?
       LIMIT 1`,
    )
    .get(name) as
    | {
        iv: string;
        auth_tag: string;
        encrypted_value: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return decryptValue({
    iv: row.iv,
    authTag: row.auth_tag,
    encryptedValue: row.encrypted_value,
  });
}

export function hasSecureCredential(name: SecureCredentialName) {
  return Boolean(
    db
      .prepare(
        `SELECT 1
         FROM secure_credentials
         WHERE name = ?
         LIMIT 1`,
      )
      .get(name),
  );
}

export function getSecureCredentialSource(name: SecureCredentialName) {
  if (hasSecureCredential(name)) {
    return "stored" as const;
  }

  if (name === "figma_access_token" && process.env.FIGMA_ACCESS_TOKEN) {
    return "env" as const;
  }

  if (name === "github_token" && (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT)) {
    return "env" as const;
  }

  return "missing" as const;
}

export function setSecureCredential(name: SecureCredentialName, value: string | null | undefined) {
  if (!value || !value.trim()) {
    db.prepare(`DELETE FROM secure_credentials WHERE name = ?`).run(name);
    return;
  }

  const encrypted = encryptValue(value.trim());
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO secure_credentials (name, iv, auth_tag, encrypted_value, created_at, updated_at)
     VALUES (@name, @iv, @authTag, @encryptedValue, @createdAt, @updatedAt)
     ON CONFLICT(name) DO UPDATE SET
       iv = excluded.iv,
       auth_tag = excluded.auth_tag,
       encrypted_value = excluded.encrypted_value,
       updated_at = excluded.updated_at`,
  ).run({
    name,
    ...encrypted,
    createdAt: now,
    updatedAt: now,
  });
}
