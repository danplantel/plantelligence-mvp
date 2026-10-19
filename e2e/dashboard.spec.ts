import { expect, type Page, test } from "@playwright/test";

/**
 * Dashboard E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1);
 *  - E2E_EMAIL / E2E_PASSWORD for the owner journeys;
 *  - E2E_VIEWER_EMAIL / E2E_VIEWER_PASSWORD for the read-only journey.
 *
 * Everything skips cleanly when unconfigured.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const viewerEmail = process.env.E2E_VIEWER_EMAIL;
const viewerPassword = process.env.E2E_VIEWER_PASSWORD;

const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const hasCredentials = !!email && !!password;
const hasViewer = !!viewerEmail && !!viewerPassword;

async function signIn(page: Page, userEmail: string, userPassword: string) {
  await page.goto("/signin");
  await page.getByPlaceholder("Enter your email").fill(userEmail);
  await page.getByPlaceholder("Enter your password").fill(userPassword);
  await page.getByRole("button", { name: /continue with email/i }).click();
  await page.waitForURL(/\/dashboard|\/onboarding|\/benefits/, {
    timeout: 30_000,
  });
}

test.describe("dashboard", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the owner journey",
  );

  test("shows the owner identity, insights, actions, and team panel", async ({
    page,
  }) => {
    await signIn(page, email!, password!);
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: /Welcome back,/ }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText("Active Plans", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Needs Attention", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Meetings this Week", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("KPI 4", { exact: true })).toBeVisible();

    await expect(page.getByText("Create Plan", { exact: true })).toBeVisible();
    await expect(page.getByText("View Plans", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Team Members", { exact: true }),
    ).toBeVisible();
  });

  test("opens the Active Plans insight", async ({ page }) => {
    await signIn(page, email!, password!);
    await page.goto("/dashboard");

    await page.getByText("Active Plans", { exact: true }).click();

    await expect(
      page.getByText(/No active plans yet|View\/Edit|^View$/),
    ).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("dashboard as a Viewer", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasViewer,
    "Set E2E_VIEWER_EMAIL / E2E_VIEWER_PASSWORD to run the Viewer journey",
  );

  test("withholds write actions and the team panel", async ({ page }) => {
    await signIn(page, viewerEmail!, viewerPassword!);
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: /Welcome back,/ }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText("View Plans", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Create Plan", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Team Members", { exact: true }),
    ).toHaveCount(0);
  });
});
