import { createHash, randomUUID } from "node:crypto";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function hashParts(parts: string[]) {
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 12);
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
