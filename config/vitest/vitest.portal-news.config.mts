import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the Portal's News & Events surface
 * (`/{plan}/news-events`) — the page composition plus the header, published
 * news-post list, webinars wrapper and asset hook it mounts.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` so `pnpm test:portal-news` cannot pick up unrelated tests.
 */
const portalNewsTests = [
  // Composition: plan id, brand colors, branding-image input/output, surface
  "app/(portal)/[id]/news-events/__tests__/page.test.tsx",
  // The same page rendering the real header (background resolution, one h1)
  "app/(portal)/[id]/news-events/__tests__/integration.test.tsx",
  // Malformed plan data: non-string banner, missing/empty id, defaults
  "app/(portal)/[id]/news-events/__tests__/page-error-paths.test.tsx",
  // Published posts: loading/empty/sort, dates, backgrounds, CTA
  "components/pages/client-portal/sections/__tests__/news-post-list.test.tsx",
  // Post edge cases: publish window, invalid dates, CTA schemes, dead prop
  "components/pages/client-portal/sections/__tests__/news-post-list-edge.test.tsx",
  // The banner: default/custom title and background, overlay
  "components/pages/client-portal/sections/__tests__/news-events-header.test.tsx",
  // The banner edges: whitespace/absent background, single h1
  "components/pages/client-portal/sections/__tests__/news-events-header-edge.test.tsx",
  // The webinars wrapper on this route
  "components/pages/client-portal/sections/__tests__/webinars-dashboard.test.tsx",
  // The wrapper must not render documents or support contacts
  "components/pages/client-portal/sections/__tests__/webinars-dashboard-parity.test.tsx",
  // The pure helpers behind the webinar cards
  "components/pages/client-portal/sections/__tests__/webinar-helpers.test.ts",
  // One scheduled / past meeting card
  "components/pages/client-portal/sections/__tests__/upcoming-webinar-card.test.tsx",
  // One on-demand replay card, including the lazy file fetch
  "components/pages/client-portal/sections/__tests__/webinar-replay-card.test.tsx",
  // The meetings + replays band and its lifecycle
  "components/pages/client-portal/sections/__tests__/videos-card-section.test.tsx",
  // The public news-post feed hook behind the list
  "hooks/__tests__/useMarketingAssets.test.ts",
  // Pop-up page targeting (which pages a pop-up appears on)
  "hooks/__tests__/shouldShowPopUpOnPage.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: portalNewsTests,
  },
});
