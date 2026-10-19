#!/usr/bin/env node

/**
 * Run every Settings test.
 *
 * Uses `vitest.settings.config.mts`, which includes the Settings page suite
 * (87 tests at the time of writing) plus any future `components/pages/settings`
 * and `components/settings` section suites.
 *
 * Usage:
 *   node scripts/tests/run-settings-tests.mjs
 *   node scripts/tests/run-settings-tests.mjs --watch
 *   node scripts/tests/run-settings-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config vitest.settings.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Settings unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Settings tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`\n✖ Settings tests failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("\n✔ Settings test run complete.");
