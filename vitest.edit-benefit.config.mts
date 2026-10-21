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
  // The Preview tab: editor auto-open, modes, logo/brand/typography
  "components/pages/benefits/__tests__/edit-benefit-preview-section.test.tsx",
  // The shared wizard steps the Edit page renders per tab
  "components/wizard/benefits-steps/__tests__/step-1.test.tsx",
  "components/wizard/benefits-steps/__tests__/step-3.test.tsx",
  "components/wizard/benefits-steps/__tests__/step-4.test.tsx",
  "components/wizard/benefits-steps/__tests__/step-5.test.tsx",
  // Contacts-tab invite surface
  "components/pages/benefits/__tests__/invite-collaborator-dialog.test.tsx",
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
