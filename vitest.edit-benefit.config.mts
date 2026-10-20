import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to Edit Benefit.
 *
 * Covers the route gate, the editor, and the benefit-category API the editor
 * reads and writes. Reuses the default environment, aliases, setup file, and
 * exclusions, but narrows `include` so `pnpm test:edit-benefit` cannot pick up
 * unrelated tests.
 */
const editBenefitTests = [
  // The access gate and slug decoding
  "app/(dashboard)/edit-benefit/[planId]/[category]/__tests__/page.test.tsx",
  // Hydration, tabs, Custom name, save/delete, portal link, preview layout
  "components/pages/benefits/__tests__/benefit-edit-page.test.tsx",
  // GET/PUT/DELETE /api/clients/[id]/benefits/[category]
  "app/api/clients/[id]/benefits/[category]/__tests__/route.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: editBenefitTests,
  },
});
