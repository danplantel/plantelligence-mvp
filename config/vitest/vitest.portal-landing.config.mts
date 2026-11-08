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
  // The page's blue edit affordances: hero → Hero Content, mission → Mission
  // Statement, and nothing at all for a participant
  "app/(portal)/[id]/__tests__/page-edit-affordances.test.tsx",
  // The address the page and the panel agree on
  "lib/__tests__/portal-editor-sections.test.ts",
  // The panel scrolling itself to the requested section (or to an anchor inside one)
  "components/wizard/new-client-steps/sections/__tests__/editor-panel-focus.test.tsx",
  // The blue Edit button: hidden for participants, opens the named section
  "components/portal-editing/__tests__/portal-section-edit-button.test.tsx",
  // The panel's "Your Benefits at a Glance" section: four cards edited in place,
  // and the Create Benefit link a missing category gets instead
  "components/portal-editing/__tests__/portal-benefits-glance-section.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: portalLandingTests,
  },
});
