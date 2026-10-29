import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the Webinars surface.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` to the Webinars suites so `pnpm test:webinars` cannot pick
 * up unrelated tests:
 *  - the page shell
 *  - the API routes (list, create, detail, bulk delete)
 *  - the placement/video-embed helpers
 *  - the hover-preview hook and layer
 */
const webinarsTests = [
  "app/(dashboard)/communications/webinars/__tests__/page.test.tsx",
  "app/api/webinars/__tests__/routes.test.ts",
  "lib/__tests__/webinar-placements.test.ts",
  "lib/__tests__/webinar-video-embed.test.ts",
  "hooks/__tests__/useWebinarHoverPreview.test.tsx",
  "components/webinars/__tests__/webinar-hover-preview.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: webinarsTests,
  },
});
