#!/usr/bin/env node

/**
 * Run every Edit Benefit test.
 *
 * Uses `vitest.edit-benefit.config.mts`, which lists the route gate, the editor,
 * and the benefit-category API the editor reads and writes.
 *
 * Usage:
 *   node scripts/tests/run-edit-benefit-tests.mjs
 *   node scripts/tests/run-edit-benefit-tests.mjs --watch
 *   node scripts/tests/run-edit-benefit-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config vitest.edit-benefit.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Edit Benefit unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Edit Benefit tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `\n✖ Edit Benefit tests failed with exit code ${result.status}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("\n✔ Edit Benefit test run complete.");
