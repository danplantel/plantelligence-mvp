/**
 * Shared bootstrap for the teammate scripts.
 *
 * Prisma's CLI loads `.env` automatically; a plain `npx tsx` run does not, so
 * these scripts read the project `.env` themselves before constructing a client.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";

export const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const ENV_PATH = path.join(PROJECT_ROOT, ".env");

/** Load `.env` into process.env without overwriting anything already set. */
export function loadEnv(): void {
  try {
    if (!fs.existsSync(ENV_PATH)) return;
    const content = fs.readFileSync(ENV_PATH, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Best-effort: fall back to whatever the shell already exports.
  }
}

/** Load env then create a client the caller is responsible for disconnecting. */
export function createPrisma(): PrismaClient {
  loadEnv();
  return new PrismaClient();
}

/* ─────────────────────── assertion helpers ─────────────────────── */

let failures = 0;

export function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

export function failureCount(): number {
  return failures;
}

export function summary(title: string): void {
  const total = failures;
  console.log("");
  if (total === 0) {
    console.log(`${title}: all assertions passed.`);
  } else {
    console.error(`${title}: ${total} assertion(s) failed.`);
  }
}
