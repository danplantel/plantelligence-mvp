import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the dashboard.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` to the dashboard page suite so `pnpm test:dashboard`
 * cannot pick up unrelated tests.
 */
const dashboardTests = [
  "components/pages/dashboard/__tests__/dashboard.test.tsx",
  "components/pages/dashboard/__tests__/panels.test.tsx",
  "app/api/dashboard/__tests__/routes.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: dashboardTests,
  },
});
