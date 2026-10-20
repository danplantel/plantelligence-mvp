import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to Create Benefit (`/new-benefits`).
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` so `pnpm test:create-benefit` cannot pick up unrelated
 * tests.
 */
const createBenefitTests = [
  "app/(dashboard)/new-benefits/__tests__/page.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: createBenefitTests,
  },
});
