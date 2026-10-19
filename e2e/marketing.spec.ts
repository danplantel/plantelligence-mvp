import { expect, type Page, test } from "@playwright/test";

/**
 * Marketing E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1);
 *  - E2E_EMAIL / E2E_PASSWORD for the advisor journeys;
 *  - E2E_PLAN_NAME — the company name exactly as the plan picker renders it.
 *    Plan-scoped journeys still skip when only E2E_PLAN_ID is configured,
 *    because the picker selects by name, not by id.
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
  await expect(page.getByText("Create Marketing Asset")).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("marketing", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the Marketing journeys",
  );

  test("loads the plan picker and the Marketing workspace", async ({ page }) => {
    await signIn(page, email!, password!);
    await page.goto("/communications/marketing");

    await expect(
      page.getByRole("heading", { name: "Marketing" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("textbox", { name: "Search plans" }),
    ).toBeVisible();
  });

  test.describe("with a plan", () => {
    test.skip(
      !hasPlan,
      "Set E2E_PLAN_NAME to run the plan-scoped Marketing journeys",
    );

    test.beforeEach(async ({ page }) => {
      await signIn(page, email!, password!);
      await page.goto("/communications/marketing");
      await selectPlan(page, planName!);
    });

    test("opens the flyer creator at the format choice", async ({ page }) => {
      await page.getByRole("button", { name: /Create Flyer/ }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Meeting Based")).toBeVisible();
      await expect(dialog.getByText("Topical Flyer")).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    });

    test("walks the portal notice picker to the top-banner form", async ({
      page,
    }) => {
      await page.getByRole("button", { name: /Create Notice/ }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Portal Notice Element")).toBeVisible();

      await dialog
        .getByRole("button", { name: /Top Banner/ })
        .click();

      await expect(dialog.getByText("Headline")).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: /Save Portal Notice/ }),
      ).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    });

    test("restores the selected plan after a reload", async ({ page }) => {
      await page.reload();

      await expect(page.getByText("Create Marketing Asset")).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        page.getByRole("textbox", { name: "Search plans" }),
      ).toHaveValue(planName!);
    });
  });
});
