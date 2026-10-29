import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the app chrome.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` to the Header and Sidebar suites so
 * `pnpm test:header-sidebar` cannot pick up unrelated tests.
 */
const headerSidebarTests = [
  "components/layout/__tests__/header.test.tsx",
  "components/layout/__tests__/sidebar.test.tsx",
  // Route-level chrome selection and the onboarding → dashboard hook-order fix
  "components/layout/__tests__/layout-client.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: headerSidebarTests,
  },
});
