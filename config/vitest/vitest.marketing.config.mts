import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the Marketing surface.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` to the Marketing suites so `pnpm test:marketing`
 * cannot pick up unrelated tests:
 *  - the page shell
 *  - the API routes
 *  - the shared `lib/marketing` helpers
 *  - the asset modal, flyer templates, and image-position editor
 */
const marketingTests = [
  "app/(dashboard)/communications/marketing/__tests__/page.test.tsx",
  "app/api/marketing/__tests__/routes.test.ts",
  "lib/__tests__/marketing-urls-and-modes.test.ts",
  "lib/__tests__/marketing-qr-service.test.ts",
  "lib/__tests__/marketing-flyer-ai.test.ts",
  "lib/__tests__/marketing-render-flyer.test.ts",
  "lib/__tests__/marketing-flyer-pdf.test.ts",
  "components/pages/marketing/__tests__/marketing-asset-modal.test.tsx",
  "components/pages/marketing/__tests__/flyer-templates.test.tsx",
  "components/pages/marketing/__tests__/flyer-image-position-editor.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: marketingTests,
  },
});
