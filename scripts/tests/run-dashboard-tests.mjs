#!/usr/bin/env node

/**
 * Run every Dashboard test.
 *
 * Uses `vitest.dashboard.config.mts`, which includes the dashboard page suite
 * (21 tests at the time of writing).
 *
 * Usage:
 *   node scripts/tests/run-dashboard-tests.mjs
 *   node scripts/tests/run-dashboard-tests.mjs --watch
 *   node scripts/tests/run-dashboard-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config vitest.dashboard.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Dashboard unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Dashboard tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`\n✖ Dashboard tests failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("\n✔ Dashboard test run complete.");
