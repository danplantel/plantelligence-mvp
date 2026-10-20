import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the All Plans (View Clients) surface.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` so `pnpm test:clients` cannot pick up unrelated tests.
 */
const clientsTests = [
  // All Plans page orchestration
  "app/(dashboard)/clients/__tests__/page.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: clientsTests,
  },
});
