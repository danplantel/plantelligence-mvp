#!/usr/bin/env node

/**
 * Run every Webinars test.
 *
 * Uses `config/vitest/vitest.webinars.config.mts`, which includes the page shell, the API
 * routes, the placement/video-embed helpers, and the hover-preview hook and
 * layer (6 files at the time of writing).
 *
 * Usage:
 *   node scripts/tests/run-webinars-tests.mjs
 *   node scripts/tests/run-webinars-tests.mjs --watch
 *   node scripts/tests/run-webinars-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config config/vitest/vitest.webinars.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Webinars unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Webinars tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`\n✖ Webinars tests failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("\n✔ Webinars test run complete.");
