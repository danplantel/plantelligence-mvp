#!/usr/bin/env node

/**
 * Run every Header and Sidebar test.
 *
 * Uses `config/vitest/vitest.header-sidebar.config.mts`, which includes both chrome suites
 * (34 tests at the time of writing).
 *
 * Usage:
 *   node scripts/tests/run-header-sidebar-tests.mjs
 *   node scripts/tests/run-header-sidebar-tests.mjs --watch
 *   node scripts/tests/run-header-sidebar-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config config/vitest/vitest.header-sidebar.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Header & Sidebar unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Header & Sidebar tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `\n✖ Header & Sidebar tests failed with exit code ${result.status}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("\n✔ Header & Sidebar test run complete.");
