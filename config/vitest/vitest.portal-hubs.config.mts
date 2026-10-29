import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the Portal benefit hubs (`/{plan}/retirement`,
 * `/health-insurance`, `/life-insurance`, `/{custom-benefit-name}`) and the
 * sections/pipeline they compose.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` so `pnpm test:portal-hubs` cannot pick up unrelated tests.
 */
const portalHubTests = [
  // The advisor-facing "Incomplete Benefit Setup" trigger on every hub mount
  "components/pages/client-portal/sections/__tests__/completeness-auto-trigger.test.tsx",
  // The journey section: per-category copy, the no-video image, Watch Now
  "components/pages/client-portal/sections/__tests__/benefits-video-section.test.tsx",
  "lib/__tests__/benefits-video-fallback.test.ts",
  // The Webinars rail in the journey section: fetch, skeletons, empty state, paging
  "components/pages/client-portal/sections/__tests__/video-carousel.test.tsx",
  // The 16:9 poster card the rail uses: play badge top-right, runtime bottom-right
  "components/pages/client-portal/sections/__tests__/webinar-replay-card-poster.test.tsx",
  // The player that replaces the journey intro when a rail video is picked
  "components/pages/client-portal/sections/__tests__/video-feature-player.test.tsx",
  // The support-people cards
  "components/pages/client-portal/sections/__tests__/have-questions.test.tsx",
  // The welcome banner's "Schedule with …" CTA (scrolls to Have Questions)
  "components/pages/client-portal/sections/__tests__/portal-welcome-banner-schedule.test.tsx",
  // The banner's circular portrait: chosen image → headshot → placeholder
  "components/pages/client-portal/sections/__tests__/portal-welcome-banner-portrait.test.tsx",
  // "How Can We Help You Today?" cards and their CTA shapes
  "components/pages/client-portal/sections/__tests__/how-can-we-help-section.test.tsx",
  // The card layout rules it renders from: primary edge, order, row packing
  "lib/__tests__/help-card-layout.test.ts",
  // The FAQ accordion
  "components/__tests__/faq-section.test.tsx",
  // The portal read the hubs make: GET .../benefits/[category]?forPortal=1
  "app/api/clients/[id]/benefits/[category]/__tests__/portal-get.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: portalHubTests,
  },
});
