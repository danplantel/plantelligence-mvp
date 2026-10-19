#!/usr/bin/env node

/**
 * Run every onboarding test.
 *
 * Unit coverage uses `vitest.onboarding.config.mts`, which includes all 30
 * onboarding suites (412 tests at the time of writing). Passing `--e2e` also
 * runs the Playwright onboarding journeys; `--e2e-only` runs just those.
 *
 * Usage:
 *   node scripts/tests/run-onboarding-tests.mjs
 *   node scripts/tests/run-onboarding-tests.mjs --watch
 *   node scripts/tests/run-onboarding-tests.mjs --coverage
 *   node scripts/tests/run-onboarding-tests.mjs --e2e
 *   node scripts/tests/run-onboarding-tests.mjs --e2e-only
 */

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const coverage = args.has("--coverage");
const includeE2E = args.has("--e2e");
const e2eOnly = args.has("--e2e-only");

if (watch && includeE2E) {
  console.error("--watch cannot be combined with --e2e (Playwright has its own UI mode).");
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
  "--config vitest.onboarding.config.mts",
  coverage ? "--coverage" : "",
]
  .filter(Boolean)
  .join(" ");

if (!e2eOnly) {
  run("Onboarding unit tests (Vitest)", unitCommand);
}

if (e2eOnly || includeE2E) {
  run(
    "Onboarding end-to-end tests (Playwright)",
    "pnpm exec playwright test e2e/onboarding.spec.ts",
  );
}

console.log("\n✔ Onboarding test run complete.");
