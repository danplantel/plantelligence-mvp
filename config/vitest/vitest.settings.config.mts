import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the Settings surface.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` to the Settings page and its section suites so
 * `pnpm test:settings` cannot pick up unrelated tests.
 */
const settingsTests = [
  // Settings page orchestration
  "app/(dashboard)/settings/__tests__/page.test.tsx",

  // Section components are added here explicitly as their suites land, e.g.
  // "components/pages/settings/__tests__/team-members-section.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: settingsTests,
  },
});
