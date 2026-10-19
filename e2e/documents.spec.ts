import { expect, type Page, test } from "@playwright/test";

/**
 * Documents E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1);
 *  - E2E_EMAIL / E2E_PASSWORD for the advisor journeys;
 *  - E2E_PLAN_ID for the plan-scoped journeys (an active plan id or slug).
 *
 * Everything skips cleanly when unconfigured.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const planId = process.env.E2E_PLAN_ID;

const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const hasCredentials = !!email && !!password;
const hasPlan = !!planId;

async function signIn(page: Page, userEmail: string, userPassword: string) {
  await page.goto("/signin");
  await page.getByPlaceholder("Enter your email").fill(userEmail);
  await page.getByPlaceholder("Enter your password").fill(userPassword);
  await page.getByRole("button", { name: /continue with email/i }).click();
  await page.waitForURL(/\/dashboard|\/onboarding|\/benefits/, {
    timeout: 30_000,
  });
}

test.describe("documents", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the Documents journeys",
  );

  test("loads the plan picker and document surfaces", async ({ page }) => {
    await signIn(page, email!, password!);
    await page.goto("/documents");

    await expect(
      page.getByRole("heading", { name: "Documents" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("View Documents", { exact: true }).first()).toBeVisible();
  });

  test.describe("with a plan", () => {
    test.skip(
      !hasPlan,
      "Set E2E_PLAN_ID to run the plan-scoped Documents journeys",
    );

    test("opens the upload tab from a deep link", async ({ page }) => {
      await signIn(page, email!, password!);
      await page.goto(`/documents?planId=${planId}&tab=upload`);

      await expect(
        page.getByRole("heading", { name: "Upload Documents" }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByText(/You can upload up to 10 files at once/),
      ).toBeVisible();
    });

    test("switches between calendar and portal preview", async ({ page }) => {
      await signIn(page, email!, password!);
      await page.goto(`/documents?planId=${planId}`);

      await page.getByRole("button", { name: "Calendar" }).click();
      await expect(
        page.getByText(/No review dates scheduled|document(s)? with a review date/),
      ).toBeVisible();

      await page.getByRole("button", { name: "Preview" }).click();
      await expect(
        page.getByText("Document Preview", { exact: true }),
      ).toBeVisible();
    });
  });
});
