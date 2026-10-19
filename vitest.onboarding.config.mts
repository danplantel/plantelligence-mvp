import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the onboarding flow.
 *
 * The default `vitest.config.mts` runs the whole unit suite. This config keeps
 * the same environment, aliases, setup file, and exclusions but narrows
 * `include` to every onboarding suite, so `pnpm test:onboarding` cannot pick up
 * unrelated tests added later.
 */
const onboardingTests = [
  // Route shell
  "app/(dashboard)/onboarding/__tests__/page.test.tsx",

  // Wizard shell, step orchestration, and the real sections behind them
  "components/wizard/**/__tests__/*.test.{ts,tsx}",

  // Navigation and device gating
  "components/ui/__tests__/navigate-away-warning-dialog.test.tsx",
  "components/__tests__/desktop-only-gate.test.tsx",
  "hooks/__tests__/use-navigate-away-guard.test.tsx",
  "hooks/__tests__/useOnboardingResumeEmail.test.tsx",
  "hooks/__tests__/useWizardInit.test.tsx",
  "hooks/__tests__/use-scroll-to-error-field.test.tsx",
  "hooks/__tests__/useMediaQuery.test.tsx",

  // Validation, store, and helpers
  "lib/__tests__/wizard-validation.test.ts",
  "lib/__tests__/onboarding-wizard-store.test.ts",
  "lib/__tests__/onboarding-wizard-dirty.test.ts",

  // API route handlers
  "app/api/onboarding-wizard/__tests__/routes.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: onboardingTests,
  },
});
