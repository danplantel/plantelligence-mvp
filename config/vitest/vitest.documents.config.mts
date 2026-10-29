import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the Documents surface.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` to the Documents page/API/component/helper suites so
 * `pnpm test:documents` cannot pick up unrelated tests.
 */
const documentsTests = [
  "app/(dashboard)/documents/__tests__/page.test.tsx",
  "app/api/documents/__tests__/routes.test.ts",
  "components/pages/documents/components/__tests__/compliance-documents-upload.test.tsx",
  "components/pages/documents/components/__tests__/document-edit-modal.test.tsx",
  "components/pages/documents/components/__tests__/document-preview-modal.test.tsx",
  "components/pages/documents/tabs/__tests__/document-list-tab.test.tsx",
  "components/pages/documents/tabs/__tests__/document-preview-tab.test.tsx",
  "components/pages/documents/views/__tests__/documents-calendar-view.test.tsx",
  "components/pages/documents/views/__tests__/documents-cards-view.test.tsx",
  "components/pages/documents/views/__tests__/documents-table-view.test.tsx",
  "lib/__tests__/compliance-document-utils.test.ts",
  "lib/__tests__/document-category.test.ts",
  "lib/__tests__/document-expirations.test.ts",
  "lib/__tests__/document-sort.test.ts",
  "lib/__tests__/notification-date-keys.test.ts",
  "lib/__tests__/portal-document-language.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: documentsTests,
  },
});
