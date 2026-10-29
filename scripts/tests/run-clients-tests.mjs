#!/usr/bin/env node

/**
 * Run every All Plans (View Clients) test.
 *
 * Uses `config/vitest/vitest.clients.config.mts`, which lists the All Plans page suite plus
 * the `GET /api/clients` and `DELETE /api/clients/[id]` contract suites.
 *
 * Usage:
 *   node scripts/tests/run-clients-tests.mjs
 *   node scripts/tests/run-clients-tests.mjs --watch
 *   node scripts/tests/run-clients-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config config/vitest/vitest.clients.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ All Plans unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("All Plans tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`\n✖ All Plans tests failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("\n✔ All Plans test run complete.");
