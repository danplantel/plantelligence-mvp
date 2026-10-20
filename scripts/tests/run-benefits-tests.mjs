#!/usr/bin/env node

/**
 * Run every Browse Benefits test.
 *
 * Uses `vitest.benefits.config.mts`, which lists the server/client pages, the
 * organization strip, the plan picker, the `/api/benefits` contract, the
 * visibility write, the assignment roster, and the pure helpers the page calls.
 *
 * Usage:
 *   node scripts/tests/run-benefits-tests.mjs
 *   node scripts/tests/run-benefits-tests.mjs --watch
 *   node scripts/tests/run-benefits-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config vitest.benefits.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Browse Benefits unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Browse Benefits tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `\n✖ Browse Benefits tests failed with exit code ${result.status}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("\n✔ Browse Benefits test run complete.");
