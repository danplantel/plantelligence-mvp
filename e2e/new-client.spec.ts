import { expect, type Page, test } from "@playwright/test";

/**
 * Create Plan E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1);
 *  - E2E_EMAIL / E2E_PASSWORD for the advisor journeys;
 *  - E2E_DRAFT_NAME (optional) for the resume journey — a draft the advisor can see;
 *  - E2E_ALLOW_CREATE=1 for the journey that actually writes a draft.
 *
 * Everything skips cleanly when unconfigured, and the write journey is opt-in so
 * a normal run never leaves data behind.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const draftName = process.env.E2E_DRAFT_NAME;
const allowCreate = process.env.E2E_ALLOW_CREATE === "1";

const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const hasCredentials = !!email && !!password;
const hasDraft = !!draftName;

async function signIn(page: Page, userEmail: string, userPassword: string) {
  await page.goto("/signin");
  await page.getByPlaceholder("Enter your email").fill(userEmail);
  await page.getByPlaceholder("Enter your password").fill(userPassword);
  await page.getByRole("button", { name: /continue with email/i }).click();
  await page.waitForURL(/\/dashboard|\/onboarding|\/benefits/, {
    timeout: 30_000,
  });
}

/**
 * Open Create Plan. A return visit may show the resume dialog instead of the
 * wizard; the shell journey dismisses it by starting a new plan so the form is
 * deterministic.
 */
async function openCreatePlan(page: Page, { startNew = true } = {}) {
  await page.goto("/new-client");

  const resumeDialog = page.getByText("You have an in-progress plan");
  const planType = page.getByText("Plan Type", { exact: false }).first();

  await expect(resumeDialog.or(planType)).toBeVisible({ timeout: 30_000 });

  if (await resumeDialog.isVisible()) {
    if (!startNew) return false;
    await page.getByRole("button", { name: /Create a new plan/i }).click();
  }

  await expect(page.getByPlaceholder("Enter company name")).toBeVisible({
    timeout: 20_000,
  });
  return true;
}

test.describe("create plan", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the advisor journeys",
  );

  test("renders step 1 with the plan-type and company fields", async ({
    page,
  }) => {
    await signIn(page, email!, password!);
    await openCreatePlan(page);

    await expect(page.getByRole("radio", { name: "Client" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Prospect" })).toBeVisible();
    await expect(page.getByPlaceholder("Enter company name")).toBeVisible();
    await expect(page.getByPlaceholder("example.com")).toBeVisible();
    await expect(page.locator("#portalUrl")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Save Draft/i }),
    ).toBeVisible();
  });

  test("derives the portal URL from the company name", async ({ page }) => {
    await signIn(page, email!, password!);
    await openCreatePlan(page);

    await page.getByRole("radio", { name: "Prospect" }).click();
    await page.getByPlaceholder("Enter company name").fill("E2E Browser Plan");

    await expect(page.locator("#portalUrl")).toHaveValue("e2e-browser-plan", {
      timeout: 10_000,
    });
  });
});

test.describe("create plan draft", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the advisor journeys",
  );
  test.skip(
    !allowCreate,
    "Set E2E_ALLOW_CREATE=1 to run the journey that writes a draft",
  );

  test("saves a draft and lands on All Plans", async ({ page }) => {
    await signIn(page, email!, password!);
    await openCreatePlan(page);

    const stamp = Date.now();
    const name = `E2E Draft ${stamp}`;

    await page.getByRole("radio", { name: "Prospect" }).click();
    await page.getByPlaceholder("Enter company name").fill(name);
    await page.getByRole("button", { name: /Save Draft/i }).click();

    await page.waitForURL(/\/clients/, { timeout: 30_000 });
    await expect(page.getByPlaceholder("Search plans...")).toBeVisible();

    await page.getByPlaceholder("Search plans...").fill(name);
    await expect(page.getByText(name)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("resume a draft", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the advisor journeys",
  );
  test.skip(!hasDraft, "Set E2E_DRAFT_NAME to run the resume journey");

  test("offers the draft and continues into the wizard", async ({ page }) => {
    await signIn(page, email!, password!);
    await openCreatePlan(page, { startNew: false });

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText(draftName!)).toBeVisible();

    await dialog.getByRole("button", { name: /Continue this plan/i }).click();

    await expect(page.getByPlaceholder("Enter company name")).toBeVisible({
      timeout: 20_000,
    });
  });
});
