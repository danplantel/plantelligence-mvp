#!/usr/bin/env node

/**
 * Run every Portal benefit hub test.
 *
 * Uses `config/vitest/vitest.portal-hubs.config.mts`, which lists the hub sections (welcome
 * materials, webinars, FAQs, support contacts, completeness trigger) and the
 * portal benefit read they depend on.
 *
 * Usage:
 *   node scripts/tests/run-portal-hubs-tests.mjs
 *   node scripts/tests/run-portal-hubs-tests.mjs --watch
 *   node scripts/tests/run-portal-hubs-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config config/vitest/vitest.portal-hubs.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Portal benefit hub unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Portal hub tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `\n✖ Portal hub tests failed with exit code ${result.status}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("\n✔ Portal benefit hub test run complete.");
