import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to Web Push.
 *
 * Reuses the default environment, aliases, setup file and exclusions, but narrows `include` to the
 * push suites so `pnpm test:push` cannot pick up unrelated tests:
 *  - the shared type/guard module (category mapping, opt-out semantics)
 *  - the dashboard→portal href resolver
 *  - the subscription validators
 *  - the subscribe API route
 *  - the sender (web-push mocked, Prisma mocked)
 *  - the service worker itself, evaluated in a VM sandbox with a stubbed `self`
 *
 * The service worker is included on purpose. It is the one piece of this feature that ships as plain
 * JS outside the bundle, so nothing else in the build would catch a broken `push` handler.
 */
const pushTests = [
  "lib/push/__tests__/types.test.ts",
  "lib/push/__tests__/portal-href.test.ts",
  "lib/push/__tests__/subscriptions.test.ts",
  "lib/push/__tests__/push.server.test.ts",
  "app/api/push/subscribe/__tests__/route.test.ts",
  "public/__tests__/service-worker.test.ts",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: pushTests,
  },
});
