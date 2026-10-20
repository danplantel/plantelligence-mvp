import { expect, test } from "@playwright/test";

/**
 * Portal "My Benefits Team" E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1);
 *  - E2E_PORTAL_SLUG naming a published plan whose portal has at least one
 *    visible contact.
 *
 * The unit suites (`pnpm test:portal-team`) render the cards with mocked data,
 * so this is the only layer that proves the real plan data reaches the page and
 * that the links a participant taps are well formed. That includes the
 * `tel:tel:` regression the card suites pin at the unit level.
 */

const portalSlug = process.env.E2E_PORTAL_SLUG;
const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";

test.describe("portal-my-benefits-team", () => {
  test.skip(
    !hasApp || !portalSlug,
    "Set E2E_BASE_URL (or E2E_START_SERVER=1) and E2E_PORTAL_SLUG to run E2E",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto(`/${portalSlug}/my-benefits-team`);
  });

  test("renders the team heading and at least one contact card", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "My Benefits Team" }),
    ).toBeVisible({ timeout: 30_000 });

    // The primary card uses an h2; the other layouts use h3 names.
    await expect(
      page
        .getByRole("heading", { level: 2 })
        .first()
        .or(page.getByRole("heading", { level: 3 }).first()),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("publishes only well-formed contact links", async ({ page }) => {
    await page
      .getByRole("heading", { name: "My Benefits Team" })
      .waitFor({ timeout: 30_000 });

    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("href") ?? ""),
      );

    for (const href of hrefs) {
      // A doubled scheme (`tel:tel:+1…`, `mailto:mailto:…`) dials/opens nothing.
      expect(href).not.toMatch(/^tel:tel:/i);
      expect(href).not.toMatch(/^mailto:mailto:/i);
    }
  });

  test("opens a configured contact CTA in a new tab", async ({ page }) => {
    await page
      .getByRole("heading", { name: "My Benefits Team" })
      .waitFor({ timeout: 30_000 });

    const cta = page
      .getByRole("button", {
        name: /schedule appt|schedule appointment|contact|call now|send email/i,
      })
      .first();

    if ((await cta.count()) === 0) {
      test.skip(true, "This plan's visible contacts have no CTA configured");
      return;
    }

    const [popup] = await Promise.all([
      page.waitForEvent("popup", { timeout: 15_000 }),
      cta.click(),
    ]);

    expect(popup.url()).toBeTruthy();
  });
});
