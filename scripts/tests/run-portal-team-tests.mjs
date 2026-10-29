#!/usr/bin/env node

/**
 * Run every Portal My Benefits Team test.
 *
 * Uses `config/vitest/vitest.portal-team.config.mts`, which lists the contact-selection
 * helper, the shared CTA/company/category helpers, all three contact card
 * variants, and the two circular visual slots they use.
 *
 * Usage:
 *   node scripts/tests/run-portal-team-tests.mjs
 *   node scripts/tests/run-portal-team-tests.mjs --watch
 *   node scripts/tests/run-portal-team-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config config/vitest/vitest.portal-team.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Portal My Benefits Team unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Portal My Benefits Team tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `\n✖ Portal My Benefits Team tests failed with exit code ${result.status}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("\n✔ Portal My Benefits Team test run complete.");
