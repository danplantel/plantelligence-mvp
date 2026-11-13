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
  // How many support cards share the row, and the element tier that follows
  "lib/__tests__/support-card-layout.test.ts",
  // The CTA / show-hide settings carried from the contact row onto the card
  "lib/__tests__/contact-card-presentation.test.ts",
  // The welcome banner's "Schedule with …" CTA (scrolls to Have Questions)
  "components/pages/client-portal/sections/__tests__/portal-welcome-banner-schedule.test.tsx",
  // The banner's circular portrait: chosen image → headshot → placeholder
  "components/pages/client-portal/sections/__tests__/portal-welcome-banner-portrait.test.tsx",
  // The banner's phone-wide gradient: full-bleed on the section, no second
  // plate on the card
  "components/pages/client-portal/sections/__tests__/portal-welcome-banner-mobile-gradient.test.tsx",
  // "How Can We Help You Today?" cards and their CTA shapes
  "components/pages/client-portal/sections/__tests__/how-can-we-help-section.test.tsx",
  // Quick Answers: grouping, search, deep links, and the phone answer sheet
  "components/pages/client-portal/sections/__tests__/quick-answers-section.test.tsx",
  // The card layout rules it renders from: primary edge, order, row packing
  "lib/__tests__/help-card-layout.test.ts",
  // Putting an older plan's Quick Answers groups back in step with the library
  "lib/topics/__tests__/group-realign.test.ts",
  // Turning an address in answer copy into a real link
  "lib/text/__tests__/linkify.test.ts",
  // Group Health's shipped Featured set, 41 answers in seven groups, acronyms
  "lib/topics/__tests__/library-content.test.ts",
  // The FAQ accordion
  "components/__tests__/faq-section.test.tsx",
  // The portal read the hubs make: GET .../benefits/[category]?forPortal=1
  "app/api/clients/[id]/benefits/[category]/__tests__/portal-get.test.ts",
  // The hub Edit Panel's Disclosure section: this benefit's own row, written to
  // the plan on Save
  "components/portal-editing/editors/__tests__/portal-benefit-editor-disclosure.test.tsx",
  // Employee Resources' three blue buttons: each names its own panel section
  "app/(portal)/[id]/employee-resources/__tests__/page-edit-affordances.test.tsx",
  // A benefit hub's five blue buttons (one template, four pages)
  "app/(portal)/[id]/retirement/__tests__/page-edit-affordances.test.tsx",
  // The welcome banner's per-element pencils and the anchors they name
  "components/pages/client-portal/sections/__tests__/portal-welcome-banner-edit-pencils.test.tsx",
  // The assistant's brain: corpus over the whole shipped library + the plan's
  // placements, ranked retrieval, intent routing, hub and deep-link rules
  "lib/topics/__tests__/assistant.test.ts",
  // GET .../portal/assistant?forPortal=1 — the portal gate, plan scoping, payload
  "app/api/clients/[id]/portal/assistant/__tests__/route.test.ts",
  // The floating "Ask a question" sheet: index read, answers, chips, navigation
  "components/pages/client-portal/sections/__tests__/portal-chatbot.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: portalHubTests,
  },
});
