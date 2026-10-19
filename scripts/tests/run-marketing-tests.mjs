#!/usr/bin/env node

/**
 * Run every Marketing test.
 *
 * Uses `vitest.marketing.config.mts`, which includes the page shell, the API
 * routes, the `lib/marketing` helpers, the asset modal, the flyer templates,
 * and the flyer image-position editor (232 tests at the time of writing).
 *
 * Usage:
 *   node scripts/tests/run-marketing-tests.mjs
 *   node scripts/tests/run-marketing-tests.mjs --watch
 *   node scripts/tests/run-marketing-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config vitest.marketing.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Marketing unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Marketing tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`\n✖ Marketing tests failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("\n✔ Marketing test run complete.");
