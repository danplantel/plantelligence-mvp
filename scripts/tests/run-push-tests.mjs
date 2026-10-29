#!/usr/bin/env node

/**
 * Run every Web Push test.
 *
 * Uses `config/vitest/vitest.push.config.mts`, which covers the shared push types, the
 * dashboard→portal href resolver, the subscription validators, the subscribe API route, the sender
 * and the service worker (evaluated in a VM sandbox).
 *
 * Usage:
 *   node scripts/tests/run-push-tests.mjs
 *   node scripts/tests/run-push-tests.mjs --watch
 *   node scripts/tests/run-push-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config config/vitest/vitest.push.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Web Push unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Web Push tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`\n✖ Web Push tests failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("\n✔ Web Push test run complete.");
