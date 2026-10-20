import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the Portal's My Benefits Team surface
 * (`/{plan}/my-benefits-team`) — the page's contact-selection rules, the three
 * contact card variants it can render, and the shared helpers the cards and the
 * benefit hubs both use.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` so `pnpm test:portal-team` cannot pick up unrelated tests.
 */
const portalTeamTests = [
  // Which contact the page promotes to "primary" (and the divergence from the
  // team list's ordering)
  "lib/__tests__/portal-primary-contact.test.ts",
  // "Other" → "Other Benefits" and the union of a contact's categories
  "lib/__tests__/benefit-contact-categories.test.ts",
  // Resolving the organisation a card should name
  "lib/__tests__/resolve-contact-company-name.test.ts",
  // The first-party /contact CTA URL (topics, avatar, company, plan)
  "lib/__tests__/contact-form-link.test.ts",
  // Single-flight profile fetch + 60s cache shared with the header
  "lib/__tests__/fetch-profile.test.ts",
  // Designation chips (CFP® / AIF® / ™ rules, free text passthrough)
  "config/onboarding/__tests__/designations.test.ts",
  // The shared card entry point: team vs category placement, asPrimary, compact
  "components/pages/client-portal/sections/__tests__/benefit-contact-card.test.tsx",
  // The compact vertical card (portal + preview placeholder variants)
  "components/pages/my-benefits-team/__tests__/small-vertical-card.test.tsx",
  // The wide primary card
  "components/pages/my-benefits-team/__tests__/primary-contact-card.test.tsx",
  // The one-contact-per-row card
  "components/pages/my-benefits-team/__tests__/large-horizontal-card.test.tsx",
  // The circular avatar slot (headshot / company logo / support icon)
  "components/pages/my-benefits-team/__tests__/contact-avatar.test.tsx",
  // The large circular slot on the primary card
  "components/pages/my-benefits-team/__tests__/primary-visual.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: portalTeamTests,
  },
});
