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
  // The footer disclosure record: which row the four non-hub pages read, and the
  // two writes the Edit Panel makes to it
  "lib/__tests__/portal-disclosures.test.ts",
  // The Edit Panel's Disclosure section (text, footer background, its notice)
  "components/portal-editing/__tests__/portal-disclosure-section.test.tsx",
  // The Landing panel itself: every edit previews live, and the Disclosure
  // section is carried as the panel's last one
  "components/portal-editing/editors/__tests__/portal-home-editor-live-preview.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: portalLandingTests,
  },
});
