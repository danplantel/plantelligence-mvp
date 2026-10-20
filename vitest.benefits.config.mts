import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to Browse Benefits (`/benefits`).
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` so `pnpm test:benefits` cannot pick up unrelated tests.
 */
const benefitsTests = [
  // Server page: the organization strip's fallback ladder
  "app/(dashboard)/benefits/__tests__/page.test.tsx",
  // Client page: picker, state ladder, rows, drafts, toggles, roles
  "components/pages/benefits/__tests__/benefits-list.test.tsx",
  // The organization strip
  "components/pages/benefits/__tests__/org-service-categories.test.tsx",
  // The shared plan picker used by the page
  "components/plan-selector/__tests__/plan-search-bar.test.tsx",
  // GET /api/benefits
  "app/api/benefits/__tests__/route.test.ts",
  // The plan-level visibility PUT behind the publish/hide toggle
  "app/api/clients/[id]/__tests__/route.visibility.test.ts",
  // The per-plan assignment roster
  "app/api/teammates/plan-assignments/__tests__/route.test.ts",
  // Pure helpers the page calls directly
  "lib/__tests__/service-categories.test.ts",
  "lib/__tests__/plan-selector-storage.test.ts",
  "lib/__tests__/active-client-status.test.ts",
  "lib/__tests__/benefit-category-slug.test.ts",
  "lib/__tests__/benefit-draft.test.ts",
  "lib/__tests__/portal-surface.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: benefitsTests,
  },
});
