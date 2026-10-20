#!/usr/bin/env node

/**
 * Run every Create Benefit test.
 *
 * Uses `vitest.create-benefit.config.mts`, which lists the `/new-benefits` page
 * suite.
 *
 * Usage:
 *   node scripts/tests/run-create-benefit-tests.mjs
 *   node scripts/tests/run-create-benefit-tests.mjs --watch
 *   node scripts/tests/run-create-benefit-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config vitest.create-benefit.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Create Benefit unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Create Benefit tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `\n✖ Create Benefit tests failed with exit code ${result.status}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("\n✔ Create Benefit test run complete.");
