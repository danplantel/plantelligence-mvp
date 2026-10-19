import { expect, type Page, test } from "@playwright/test";

/**
 * Webinars E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1);
 *  - E2E_EMAIL / E2E_PASSWORD for the advisor journeys;
 *  - E2E_PLAN_NAME — the company name exactly as the plan picker renders it.
 *
 * Everything skips cleanly when unconfigured.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const planName = process.env.E2E_PLAN_NAME;

const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const hasCredentials = !!email && !!password;
const hasPlan = !!planName;

async function signIn(page: Page, userEmail: string, userPassword: string) {
  await page.goto("/signin");
  await page.getByPlaceholder("Enter your email").fill(userEmail);
  await page.getByPlaceholder("Enter your password").fill(userPassword);
  await page.getByRole("button", { name: /continue with email/i }).click();
  await page.waitForURL(/\/dashboard|\/onboarding|\/benefits/, {
    timeout: 30_000,
  });
}

async function selectPlan(page: Page, companyName: string) {
  const search = page.getByRole("textbox", { name: "Search plans" });
  await search.click();
  await search.fill(companyName);
  await page
    .getByRole("option", { name: companyName, exact: true })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Add Video" })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("webinars", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the Webinars journeys",
  );

  test("loads the plan picker and the Webinars workspace", async ({ page }) => {
    await signIn(page, email!, password!);
    await page.goto("/communications/webinars");

    await expect(page.getByText("Webinars & Replays")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("textbox", { name: "Search plans" }),
    ).toBeVisible();
  });

  test.describe("with a plan", () => {
    test.skip(
      !hasPlan,
      "Set E2E_PLAN_NAME to run the plan-scoped Webinars journeys",
    );

    test.beforeEach(async ({ page }) => {
      await signIn(page, email!, password!);
      await page.goto("/communications/webinars");
      await selectPlan(page, planName!);
    });

    test("opens the upload dialog at its defaults", async ({ page }) => {
      await page.getByRole("button", { name: "Add Video" }).click();

      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Upload Video" }),
      ).toBeVisible();
      await expect(
        dialog.getByPlaceholder("Enter webinar title"),
      ).toBeVisible();
      await expect(dialog.getByLabel(/News & Events/)).toBeChecked();
      await expect(
        dialog.getByRole("button", { name: "Add Video" }),
      ).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    });

    test("toggles the multi-select toolbar", async ({ page }) => {
      await page.getByRole("button", { name: "Select" }).click();
      await expect(page.getByText(/\d+ selected/)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Delete selected" }),
      ).toBeDisabled();

      await page.getByRole("button", { name: "Done" }).click();
      await expect(page.getByRole("button", { name: "Select" })).toBeVisible();
    });

    test("restores the selected plan after a reload", async ({ page }) => {
      await page.reload();

      await expect(page.getByRole("button", { name: "Add Video" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        page.getByRole("textbox", { name: "Search plans" }),
      ).toHaveValue(planName!);
    });
  });
});
