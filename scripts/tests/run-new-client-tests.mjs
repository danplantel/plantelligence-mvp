#!/usr/bin/env node

/**
 * Run every Create Plan (`/new-client`) page test.
 *
 * Uses `vitest.new-client.config.mts`, which includes the Create Plan page
 * suite in `app/(dashboard)/new-client/__tests__`.
 *
 * Usage:
 *   node scripts/tests/run-new-client-tests.mjs
 *   node scripts/tests/run-new-client-tests.mjs --watch
 *   node scripts/tests/run-new-client-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config vitest.new-client.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Create Plan unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Create Plan tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `\n✖ Create Plan tests failed with exit code ${result.status}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("\n✔ Create Plan test run complete.");
