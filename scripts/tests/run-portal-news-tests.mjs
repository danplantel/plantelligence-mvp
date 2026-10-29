#!/usr/bin/env node

/**
 * Run every Portal News & Events test.
 *
 * Uses `config/vitest/vitest.portal-news.config.mts`, which lists the page composition, the
 * page + real header integration, the published news-post list, the banner,
 * the webinars wrapper, and the marketing-assets hook behind the feed.
 *
 * Usage:
 *   node scripts/tests/run-portal-news-tests.mjs
 *   node scripts/tests/run-portal-news-tests.mjs --watch
 *   node scripts/tests/run-portal-news-tests.mjs --coverage
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");

const command = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config config/vitest/vitest.portal-news.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

console.log("\n▶ Portal News & Events unit tests (Vitest)\n");

const result = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error("Portal News & Events tests failed to start:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `\n✖ Portal News & Events tests failed with exit code ${result.status}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("\n✔ Portal News & Events test run complete.");
