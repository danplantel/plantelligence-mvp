import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to Edit Plan (`/edit-client/[id]`).
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` so `pnpm test:edit-client` cannot pick up unrelated tests.
 */
const editClientTests = [
  // Page orchestration: branches, header/title, tab portal, save bar
  "app/(dashboard)/edit-client/[id]/__tests__/page.test.tsx",
  // Header band: validation badges, Open Portal, delete-plan gate
  "components/pages/edit-client/__tests__/edit-client-header.test.tsx",
  // Fixed save bar: canSave matrix, hint, busy label
  "components/pages/edit-client/__tests__/save-button.test.tsx",
  // Data layer: load mapping, validation, PUT payload, form helpers
  "hooks/__tests__/useEditClient.test.tsx",
  // Visibility normalizer shared by the PUT route and the portal reads
  "lib/__tests__/portal-category-visibility.test.ts",
  // Portal-slug lifecycle: register, rename (alias kept), release, resolve
  "lib/__tests__/slug-registry.test.ts",
  // PUT /api/clients/[id] contract (access, payload, rename, retries)
  "app/api/clients/[id]/__tests__/put.test.ts",
  // GET/DELETE /api/clients/[id]/slugs (Previous URLs list)
  "app/api/clients/[id]/__tests__/slugs.test.ts",
  // GET /api/check-portal-url (debounced availability check)
  "app/api/check-portal-url/__tests__/route.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: editClientTests,
  },
});
