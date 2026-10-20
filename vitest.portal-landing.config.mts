import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the Portal Landing page (`/(portal)/[id]`).
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` so `pnpm test:portal-landing` cannot pick up unrelated
 * tests.
 */
const portalLandingTests = [
  // Landing page projection: contacts, visibility fallback, footer preference
  "app/(portal)/[id]/__tests__/page.test.tsx",
  // Provider: portal fetch, archived/alias handling, skeleton, refetch events
  "contexts/__tests__/client-portal-context.test.tsx",
  // The four hub cards: defaults, visibility, partner branding, completeness
  "components/pages/client-portal/sections/__tests__/portal-benefits.test.tsx",
  // Hero + mission: copy fallbacks and the preview-only edit affordances
  "components/pages/client-portal/sections/__tests__/portal-hero-mission.test.tsx",
  // Completeness matrix behind the "finish this benefit" dialog
  "lib/__tests__/benefit-completeness.test.ts",
  // Footer disclaimer text/placeholder resolution
  "lib/__tests__/disclaimer-constants.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: portalLandingTests,
  },
});
