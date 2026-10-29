#!/usr/bin/env node

/**
 * Run every Settings test.
 *
 * Uses `config/vitest/vitest.settings.config.mts`, which includes the Settings page suite
 * (91 tests at the time of writing) plus any future `components/pages/settings`
 * and `components/settings` section suites. Passing `--e2e` also runs the
 * Playwright settings journeys; `--e2e-only` runs just those.
 *
 * The E2E suite provisions its own throwaway account through /signup, completes
 * onboarding through the wizard API (the middleware gate needs a completed
 * wizard session to reach /settings), passes the Early Access gate with 22222,
 * and deletes the account again — no E2E_EMAIL / E2E_PASSWORD. It does need an
 * app (`E2E_BASE_URL`, or `E2E_START_SERVER=1`) and skips cleanly without one.
 *
 * Usage:
 *   node scripts/tests/run-settings-tests.mjs
 *   node scripts/tests/run-settings-tests.mjs --watch
 *   node scripts/tests/run-settings-tests.mjs --coverage
 *   node scripts/tests/run-settings-tests.mjs --e2e
 *   node scripts/tests/run-settings-tests.mjs --e2e-only
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");
const includeE2E = args.has("--e2e");
const e2eOnly = args.has("--e2e-only");

if (watch && includeE2E) {
  console.error(
    "--watch cannot be combined with --e2e (Playwright has its own UI mode).",
  );
  process.exit(1);
}

function run(label, command) {
  console.log(`\n▶ ${label}\n`);

  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (result.error) {
    console.error(`${label} failed to start:`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n✖ ${label} failed with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

const unitCommand = [
  "pnpm exec vitest",
  watch ? "" : "run",
  "--config config/vitest/vitest.settings.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

if (!e2eOnly) {
  run("Settings unit tests (Vitest)", unitCommand);
}

if (e2eOnly || includeE2E) {
  run(
    "Settings end-to-end tests (Playwright)",
    "pnpm exec playwright test e2e/settings.spec.ts",
  );
}

console.log("\n✔ Settings test run complete.");
