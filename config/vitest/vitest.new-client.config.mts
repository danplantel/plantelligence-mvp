import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to Create Plan (`/new-client`).
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` so `pnpm test:new-client` cannot pick up unrelated tests.
 */
const newClientTests = [
  // Page orchestration
  "app/(dashboard)/new-client/__tests__/page.test.tsx",
  // Resume / ownership helpers
  "lib/__tests__/new-client-wizard-resume.test.ts",
  // Draft persistence API
  "app/api/new-client-wizard/save-draft/__tests__/route.test.ts",
  // Step validation (v2)
  "lib/__tests__/new-client-wizard-validation-v2.test.ts",
  // Store internals (serializer, transition flag, saveAsDraft)
  "lib/__tests__/new-client-wizard-store.test.ts",
  // Wizard chrome (footer bar, gates, validation UX, duplicate dialog)
  "components/wizard/__tests__/new-client-wizard.test.tsx",
  // Brand-image utilities (hero/thumbnail crops, URL resolution)
  "components/wizard/new-client-steps/sections/utils/__tests__/utils.test.ts",
  // Step 1 — company basics / branding
  "components/wizard/new-client-steps/__tests__/step-1-company-basics.test.tsx",
  // Step 3 — key-contact slide routing
  "components/wizard/new-client-steps/__tests__/step-3-key-contacts.test.tsx",
  // Step 4 — compliance documents
  "components/wizard/new-client-steps/__tests__/step-4-compliance-documents.test.tsx",
  // Step 5 — footer disclosure
  "components/wizard/new-client-steps/__tests__/step-5-disclaimer.test.tsx",
  // Session lifecycle APIs (session, load-draft, list-drafts, delete-draft, cleanup)
  "app/api/new-client-wizard/__tests__/session-lifecycle.test.ts",
  // Publish API guards (complete-v2)
  "app/api/new-client-wizard/complete-v2/__tests__/route.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: newClientTests,
  },
});
