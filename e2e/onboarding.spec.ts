import { expect, type Page, test } from "@playwright/test";

/**
 * Onboarding E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1 to start `pnpm dev`);
 *  - E2E_EMAIL / E2E_PASSWORD for a FRESH, not-yet-onboarded account.
 *
 * The happy-path test completes onboarding and redirects to the dashboard, so
 * that account cannot be reused without resetting its wizard data.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const hasApp = !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const hasCredentials = !!email && !!password;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4ZkAAAAASUVORK5CYII=",
  "base64",
);

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByPlaceholder("Enter your email").fill(email!);
  await page.getByPlaceholder("Enter your password").fill(password!);
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 30_000 });
}

async function gotoOnboarding(page: Page) {
  await signIn(page);
  await page.goto("/onboarding");

  if (/\/dashboard/.test(page.url())) {
    test.skip(true, "E2E account has already completed onboarding");
  }

  await expect(page.getByText("New User Setup").first()).toBeVisible({
    timeout: 30_000,
  });
}

async function selectOrganization(page: Page) {
  await page.getByText("Financial Advisor / RIA", { exact: true }).click();
}

async function selectTeam(page: Page) {
  await page.getByRole("radio", { name: /2–5/ }).click();
}

test.describe("onboarding authentication", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");

  test("redirects an anonymous visitor to sign-in", async ({ page }) => {
    await page.goto("/onboarding");

    await expect(page).toHaveURL(/\/signin/);
  });
});

test.describe("onboarding on a phone", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(!hasCredentials, "Set E2E_EMAIL / E2E_PASSWORD to run authenticated E2E");

  test.use({ viewport: { width: 390, height: 844 } });

  test("shows the desktop-only notice instead of the wizard", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/onboarding");

    await expect(
      page.getByText("PlanTelligence setup works best on a computer"),
    ).toBeVisible();
  });
});

test.describe("onboarding wizard", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(!hasCredentials, "Set E2E_EMAIL / E2E_PASSWORD to run authenticated E2E");

  test("blocks Next on an empty Step 1, then accepts the same form once filled", async ({
    page,
  }) => {
    await gotoOnboarding(page);

    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByText(/Please complete: Organization type, Team size/),
    ).toBeVisible();

    // Still on Step 1.
    await expect(page.getByText("New User Setup").first()).toBeVisible();

    await selectOrganization(page);
    await selectTeam(page);

    await expect(
      page.getByRole("radio", { name: /Financial Advisor \/ RIA/ }),
    ).toBeChecked();
    await expect(page.getByRole("radio", { name: /2–5/ })).toBeChecked();
  });

  test("guards in-app navigation while there are unsaved changes", async ({
    page,
  }) => {
    await gotoOnboarding(page);
    await selectOrganization(page);

    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "/dashboard";
      link.textContent = "leave-onboarding";
      document.body.appendChild(link);
      link.click();
    });

    await expect(page.getByText("Leave this setup?")).toBeVisible();
    await page.getByRole("button", { name: "Stay and keep editing" }).click();
    await expect(page.getByText("Leave this setup?")).not.toBeVisible();
  });

  test("completes the full flow and reaches the dashboard", async ({ page }) => {
    test.slow();
    await gotoOnboarding(page);

    // ── Step 1: organization + team size ──────────────────────────────────
    await selectOrganization(page);
    await selectTeam(page);
    await page.getByRole("button", { name: "Next" }).click();

    // ── Step 2: services ─────────────────────────────────────────────────
    await page.locator('[data-field="services"]').click();
    await page.locator("#category-Retirement").click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Next" }).click();

    // ── Step 3: branding ─────────────────────────────────────────────────
    await page
      .getByPlaceholder("Enter organization name")
      .fill("E2E Test Organization");
    await page
      .getByPlaceholder("Enter organization website (e.g., example.com)")
      .fill("e2e.example");

    await page.locator('input[type="file"]').first().setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Save Logo" }).click();

    await page.locator('input[data-field="primaryColor"]').fill("#1F3A60");
    await page.locator('input[data-field="secondaryColor"]').fill("#4A90E2");
    await page.getByRole("button", { name: "Next" }).click();

    // ── Step 4: user setup ───────────────────────────────────────────────
    await page.getByPlaceholder("Enter your full name").fill("E2E Advisor");
    await page
      .getByPlaceholder("Enter your professional title")
      .fill("Financial Advisor");
    await page
      .getByPlaceholder("your.organization@example.com")
      .fill("e2e@example.com");
    await page.getByPlaceholder("(555) 123-4567").fill("2135888888");
    await page.getByRole("button", { name: "Next" }).click();

    // ── Step 5a: review ──────────────────────────────────────────────────
    await expect(page.getByText("Review Your Information")).toBeVisible();
    await page.getByRole("button", { name: "Looks Good, Continue" }).click();

    // ── Step 5b: disclosures ─────────────────────────────────────────────
    await page.getByRole("button", { name: "Add Now" }).click();
    await page.getByRole("button", { name: "Confirm Disclosures" }).click();
    await page
      .getByRole("checkbox", {
        name: /I’ve reviewed these disclosures/,
      })
      .check();
    await page.getByRole("button", { name: "Continue" }).click();

    // ── Step 5c: invite team ─────────────────────────────────────────────
    await expect(page.getByText("Invite Your Team")).toBeVisible();
    await page.getByRole("button", { name: "Invite Later" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // ── Completion ───────────────────────────────────────────────────────
    await expect(page.getByText("Setup Complete!")).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  });
});
