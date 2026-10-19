#!/usr/bin/env node

/**
 * Run every Meetings test.
 *
 * Uses `vitest.meetings.config.mts`, which includes the page shell, the API
 * routes, the meeting/date helpers and stores, and the calendar, day drawer,
 * and plan-scoped schedule form (12 files, 224 tests at the time of writing).
 *
 * Usage:
 *   node scripts/tests/run-meetings-tests.mjs
 *   node scripts/tests/run-meetings-tests.mjs --watch
 *   node scripts/tests/run-meetings-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config vitest.meetings.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Meetings unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Meetings tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`\n✖ Meetings tests failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("\n✔ Meetings test run complete.");
