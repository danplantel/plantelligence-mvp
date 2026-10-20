#!/usr/bin/env node

/**
 * Run every Edit Plan (`/edit-client/[id]`) unit test.
 *
 * Uses `vitest.edit-client.config.mts`, which lists the page suite, the header
 * and save-button components, the `useEditClient` hook, the visibility and
 * slug-registry helpers, and the three API routes the editor writes through.
 *
 * Usage:
 *   node scripts/tests/run-edit-client-tests.mjs
 *   node scripts/tests/run-edit-client-tests.mjs --watch
 *   node scripts/tests/run-edit-client-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config vitest.edit-client.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Edit Plan unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Edit Plan tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`\n✖ Edit Plan tests failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("\n✔ Edit Plan test run complete.");
