import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the Portal Navbar / chrome
 * (`app/(portal)/[id]/layout.tsx`) and the pieces it composes.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` so `pnpm test:portal-navbar` cannot pick up unrelated
 * tests.
 */
const portalNavbarTests = [
  // The chrome itself: composition, banner, back links, light mode, disclosures
  "app/(portal)/[id]/__tests__/layout.test.tsx",
  // The floating "Ask a question" chatbot that replaced the header button
  "components/pages/client-portal/sections/__tests__/portal-chatbot.test.tsx",
  // The header's Login button: hub pages only, scrolls to the help section
  "components/pages/client-portal/sections/__tests__/portal-header-login.test.tsx",
  // The portal's own 404, rendered inside this chrome
  "app/(portal)/[id]/not-found/__tests__/page.test.tsx",
  // The three gates that arm the Comments rail
  "components/comments/__tests__/portal-comments-rail.test.tsx",
  // Scale + height math for the scaled portal
  "components/comments/__tests__/portal-comments-zoom.test.tsx",
  // The footer the layout passes its resolved disclosure text to
  "components/layout/__tests__/footer.test.tsx",
  // Banner CTA normalisation and countdown arithmetic
  "lib/__tests__/portal-banner.test.ts",
  // Custom hub naming, placeholders and the portal route segment
  "lib/__tests__/benefit-custom-name.test.ts",
  // Footer text colour rule
  "lib/__tests__/light-surface-text-color.test.ts",
  // Typography custom properties applied to the portal root
  "lib/__tests__/typography-themes.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: portalNavbarTests,
  },
});
