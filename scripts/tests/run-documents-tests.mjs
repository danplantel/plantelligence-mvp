#!/usr/bin/env node

/**
 * Run every Documents page test.
 *
 * Uses `vitest.documents.config.mts`, which includes the Documents page, API,
 * component, and helper suites (305 tests across 16 files at the time of writing).
 *
 * Usage:
 *   node scripts/tests/run-documents-tests.mjs
 *   node scripts/tests/run-documents-tests.mjs --watch
 *   node scripts/tests/run-documents-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config vitest.documents.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Documents unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Documents tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`\n✖ Documents tests failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("\n✔ Documents test run complete.");
