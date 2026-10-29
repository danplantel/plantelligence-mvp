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
  // The page shell and its step-validation gate
  "app/(dashboard)/new-benefits/__tests__/page.test.tsx",
  // The shared wizard steps, driven by the Create flow
  "components/wizard/benefits-steps/__tests__/step-1.test.tsx",
  "components/wizard/benefits-steps/__tests__/step-3.test.tsx",
  "components/wizard/benefits-steps/__tests__/step-4.test.tsx",
  "components/wizard/benefits-steps/__tests__/step-5.test.tsx",
  // Step 3's invite surface
  "components/pages/benefits/__tests__/invite-collaborator-dialog.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: createBenefitTests,
  },
});
