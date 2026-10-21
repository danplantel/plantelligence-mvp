import { expect, test } from "@playwright/test";

/**
 * Portal "News & Events" E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1);
 *  - E2E_PORTAL_SLUG naming a published plan.
 *
 * The unit suites render every section with mocked data, so this is the only
 * layer that proves the real plan's meetings, replays and published posts reach
 * the page together, and that the links are well formed end to end.
 */

const portalSlug = process.env.E2E_PORTAL_SLUG;
const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";

test.describe("portal-news-events", () => {
  test.skip(
    !hasApp || !portalSlug,
    "Set E2E_BASE_URL (or E2E_START_SERVER=1) and E2E_PORTAL_SLUG to run E2E",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto(`/${portalSlug}/news-events`);
  });

  test("renders the header and the three sections", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: "News & Events" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Upcoming Meetings & Webinars" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Past Meetings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Webinar Replays" }),
    ).toBeVisible();
  });

  test("publishes only well-formed links", async ({ page }) => {
    await page
      .getByRole("heading", { level: 1, name: "News & Events" })
      .waitFor({ timeout: 30_000 });

    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("href") ?? ""),
      );

    for (const href of hrefs) {
      expect(href).not.toMatch(/^tel:tel:/i);
      expect(href).not.toMatch(/^mailto:mailto:/i);
      // A CTA is never a bare host with the scheme bolted onto a scheme.
      expect(href).not.toMatch(/^https?:\/\/(mailto|tel|javascript):/i);
    }
  });

  test("opens a post CTA in a new tab", async ({ page }) => {
    await page
      .getByRole("heading", { level: 1, name: "News & Events" })
      .waitFor({ timeout: 30_000 });

    const cta = page.locator("a[target='_blank']").first();
    if ((await cta.count()) === 0) {
      test.skip(true, "This plan has no post or replay CTA configured");
      return;
    }

    const [popup] = await Promise.all([
      page.waitForEvent("popup", { timeout: 15_000 }),
      cta.click(),
    ]);

    expect(popup.url()).toBeTruthy();
  });

  test("keeps the header readable at a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const heading = page.getByRole("heading", {
      level: 1,
      name: "News & Events",
    });
    await expect(heading).toBeVisible({ timeout: 30_000 });

    const box = await heading.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
  });
});
