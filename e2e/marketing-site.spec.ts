import { expect, test } from "@playwright/test";

/**
 * Public marketing site E2E.
 *
 * The marketing page is served at `/` only when the request host is a
 * marketing host. The suite sends `x-forwarded-host: plantel.ai` so a local or
 * preview deployment exercises the same branch middleware uses in production.
 *
 * Everything skips cleanly when no app is configured.
 */

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const hasApp = !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const baseIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(baseURL);

test.describe("marketing site", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");

  test.use({ extraHTTPHeaders: { "x-forwarded-host": "plantel.ai" } });

  test("renders the landing page with working section anchors", async ({
    page,
  }) => {
    await page.goto("/");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("Every benefit");
    await expect(heading).toContainText("one clear story");

    for (const anchor of [
      "#features",
      "#portal",
      "#communications",
      "#team",
      "#faq",
    ]) {
      await expect(page.locator(anchor)).toHaveCount(1);
    }

    await expect(
      page.getByRole("link", { name: "Sign in" }).first(),
    ).toHaveAttribute("href", "https://plantel.pro/signin");
  });

  test("opens a FAQ answer", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("button", { name: "What is PlanTelligence?" })
      .click();

    await expect(
      page.getByText(/benefits communication platform for the people/i),
    ).toBeVisible();
  });

  test("opens the mobile navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: "Open menu" }).click();

    await expect(
      page.getByRole("navigation", { name: "Marketing mobile" }),
    ).toBeVisible();
  });
});

test.describe("app origin root", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");

  // The landing page is the root on the app host too, so name the host
  // explicitly instead of inheriting the (loopback) base URL host.
  test.use({ extraHTTPHeaders: { "x-forwarded-host": "plantel.pro" } });

  test("renders the marketing page at /", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Every benefit",
    );
    await expect(page).not.toHaveURL(/\/signin/);
  });

  test("keeps sign-in on its own path", async ({ page }) => {
    await page.goto("/signin");

    await expect(page).toHaveURL(/\/signin/);
  });
});

test.describe("local preview", () => {
  test.skip(
    !hasApp || !baseIsLocal,
    "The loopback preview only exists when the base URL is localhost",
  );

  // No host override: a loopback origin serves the marketing page at `/` and
  // the app everywhere else from the same dev server.
  test("renders the marketing page at /", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Every benefit",
    );
    await expect(page).not.toHaveURL(/\/signin/);
  });
});
