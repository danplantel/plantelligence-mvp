#!/usr/bin/env node

/**
 * Run every Portal Navbar / chrome test.
 *
 * Uses `config/vitest/vitest.portal-navbar.config.mts`, which lists the portal layout, its
 * 404 page, the Comments rail/zoom, the footer, and the helpers they compose.
 *
 * Usage:
 *   node scripts/tests/run-portal-navbar-tests.mjs
 *   node scripts/tests/run-portal-navbar-tests.mjs --watch
 *   node scripts/tests/run-portal-navbar-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config config/vitest/vitest.portal-navbar.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Portal Navbar unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Portal Navbar tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `\n✖ Portal Navbar tests failed with exit code ${result.status}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("\n✔ Portal Navbar test run complete.");
