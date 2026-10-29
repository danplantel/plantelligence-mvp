import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the auth flow.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` to the sign-in, sign-up, verification-code, and resume-link
 * suites so `pnpm test:auth` cannot pick up unrelated tests.
 */
const authTests = [
  // Shared schemas and navigation rules
  "lib/__tests__/form-schema.test.ts",
  "lib/__tests__/sign-in-redirect.test.ts",

  // Sign in
  "app/(dashboard)/signin/__tests__/page.test.tsx",
  "components/pages/sign-in/__tests__/sign-in.test.tsx",
  "components/forms/__tests__/user-auth-form.test.tsx",
  "components/forms/__tests__/google-auth-button.test.tsx",

  // Sign up
  "app/(dashboard)/signup/__tests__/page.test.tsx",
  "components/forms/__tests__/user-signup-form.test.tsx",

  // Forgot / reset password
  "app/(dashboard)/forget/__tests__/page.test.tsx",
  "components/forms/__tests__/forget-password-form.test.tsx",
  "app/(dashboard)/reset-password/__tests__/page.test.tsx",
  "components/forms/__tests__/reset-pass-form.test.tsx",
  "lib/__tests__/reset-token.server.test.ts",

  // Verification code
  "app/(dashboard)/verify-code/__tests__/page.test.tsx",
  "components/forms/__tests__/verify-code-form.test.tsx",

  // Resume onboarding link
  "components/forms/__tests__/resume-onboarding-link.test.tsx",

  // Route protection
  "lib/__tests__/middleware.test.ts",

  // Auth API handlers
  "app/api/__tests__/auth-routes.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: authTests,
  },
});
