import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Vitest config scoped to the Meetings surface.
 *
 * Reuses the default environment, aliases, setup file, and exclusions, but
 * narrows `include` to the Meetings suites so `pnpm test:meetings` cannot pick
 * up unrelated tests:
 *  - the page shell
 *  - the API routes (including reminders and custom meeting types)
 *  - the shared meeting/date helpers and stores
 *  - the calendar, day drawer, and plan-scoped schedule form
 */
const meetingsTests = [
  "app/(dashboard)/communications/meetings/__tests__/page.test.tsx",
  "app/api/meetings/__tests__/routes.test.ts",
  "lib/__tests__/meeting-reminders.test.ts",
  "lib/__tests__/meeting-schedule-shared.test.ts",
  "lib/__tests__/date-schedule-day.test.ts",
  "lib/__tests__/meeting-start-at.test.ts",
  "lib/__tests__/meeting-display.test.ts",
  "lib/__tests__/meeting-store.test.ts",
  "lib/__tests__/meeting-debug-store.test.ts",
  "components/meetings/__tests__/meetings-calendar-view.test.tsx",
  "components/meetings/__tests__/meeting-day-drawer.test.tsx",
  "components/meetings/__tests__/plan-meeting-schedule-form.test.tsx",
];

const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: meetingsTests,
  },
});
