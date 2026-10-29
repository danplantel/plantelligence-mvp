#!/usr/bin/env node

/**
 * Run every Portal Landing test.
 *
 * Uses `config/vitest/vitest.portal-landing.config.mts`, which lists the landing page, the
 * portal context, the hero/mission and benefits sections, and the shared
 * helpers in `lib/` they compose.
 *
 * Usage:
 *   node scripts/tests/run-portal-landing-tests.mjs
 *   node scripts/tests/run-portal-landing-tests.mjs --watch
 *   node scripts/tests/run-portal-landing-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config config/vitest/vitest.portal-landing.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Portal Landing unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Portal Landing tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `\n✖ Portal Landing tests failed with exit code ${result.status}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("\n✔ Portal Landing test run complete.");
