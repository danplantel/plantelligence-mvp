import {
  expect,
  type Browser,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

/**
 * Onboarding E2E.
 *
 * Prerequisite: an app reachable at E2E_BASE_URL, or E2E_START_SERVER=1 to let
 * Playwright start `pnpm dev`.
 *
 * The suite is self-provisioning: `beforeAll` enters the Early Access code,
 * creates a unique user through /signup, and `afterAll` deletes that user
 * through the app's own DELETE /api/profile/delete cascade (plans, wizard
 * sessions, organization, then the user). No E2E_EMAIL / E2E_PASSWORD is read
 * here, so a stale shell value cannot silently reuse an old account.
 *
 * Escape hatch: E2E_KEEP_USER=1 keeps the self-created account for inspection
 * and prints its credentials.
 */

const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// Keep in sync with the code accepted by components/modals/invite-code-modal.tsx.
const EARLY_ACCESS_CODE = "22222";
const KEEP_USER = process.env.E2E_KEEP_USER === "1";

interface TestUser {
  name: string;
  email: string;
  password: string;
}

let user: TestUser | null = null;
let provisionError: Error | null = null;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4ZkAAAAASUVORK5CYII=",
  "base64",
);

function inviteDialog(page: Page) {
  return page.getByRole("dialog").filter({ hasText: "Early Access" });
}

async function fillInviteCode(dialog: Locator, code: string) {
  const inputs = dialog.locator("input");
  await expect(inputs).toHaveCount(code.length);
  for (let index = 0; index < code.length; index += 1) {
    await inputs.nth(index).fill(code[index]);
  }
}

/**
 * Enter the real Early Access gate.
 *
 * `InviteCodeProvider` renders a full-screen invite-code dialog until the
 * correct code is accepted. It is client-side state, so every fresh browser
 * context must pass it once; the code is 22222 (see InviteCodeModal).
 */
async function enterEarlyAccessCode(page: Page, code = EARLY_ACCESS_CODE) {
  const dialog = inviteDialog(page);
  const emailField = page.getByPlaceholder("Enter your email");

  // The gate may already be unlocked in this context (e.g. a second visit),
  // in which case the sign-in field is what appears instead.
  await Promise.race([
    dialog
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined),
    emailField
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined),
  ]);

  if (!(await dialog.isVisible().catch(() => false))) return;

  // Retry the whole interaction: in dev the first paint can be visible before
  // React hydrates, and a click then has no handler (the modal simply stays).
  await expect(async () => {
    await fillInviteCode(dialog, code);
    await dialog.getByRole("button", { name: "Enter Code" }).click();
    await expect(dialog).toBeHidden({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

async function signIn(page: Page, credentials: TestUser) {
  await page.goto("/signin");
  await enterEarlyAccessCode(page);
  await page.getByPlaceholder("Enter your email").fill(credentials.email);
  // The password field mounts when the email becomes non-empty. `exact` keeps
  // this from also matching the signup form's "Re-enter your password".
  await page
    .getByPlaceholder("Enter your password", { exact: true })
    .fill(credentials.password);
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 30_000 });
}

/**
 * Create the throwaway account through the real signup UI.
 *
 * The form signs the new user in and routes to /onboarding. The unique `.test`
 * address is deliberately non-deliverable; onboarding's confirmation email is
 * best-effort and must not block the flow.
 */
async function createFreshUser(browser: Browser): Promise<TestUser> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const stamp = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const credentials: TestUser = {
    name: "E2E Onboarding",
    email: `e2e+${stamp}@plantelligence.test`,
    // Requires uppercase, lowercase, number and special character.
    password: `E2e!Pass1${stamp}`,
  };

  try {
    await page.goto("/signin");
    await enterEarlyAccessCode(page);

    await page.getByRole("link", { name: "Create New Account" }).click();
    await expect(page).toHaveURL(/\/signup/);

    await page.getByPlaceholder("Enter your name").fill(credentials.name);
    await page.getByPlaceholder("Enter your email").fill(credentials.email);
    await page
      .getByPlaceholder("Enter your password", { exact: true })
      .fill(credentials.password);
    await page
      .getByPlaceholder("Re-enter your password")
      .fill(credentials.password);

    await page.getByRole("button", { name: "Sign Up" }).click();

    // The form signs in automatically after signup. If that call fails it
    // routes to /signin instead, so handle both outcomes.
    await page.waitForURL(/\/onboarding|\/signin/, { timeout: 30_000 });
    if (!/\/onboarding/.test(page.url())) {
      await signIn(page, credentials);
    }

    // The account exists from this point, even if the wizard assertion below
    // fails; record it so `afterAll` can still delete it.
    user = credentials;

    await expect(page.getByText("New User Setup").first()).toBeVisible({
      timeout: 30_000,
    });
    console.log(`[e2e] created onboarding user ${credentials.email}`);
    return credentials;
  } finally {
    await context.close();
  }
}

function requireUser(): TestUser {
  if (provisionError) throw provisionError;
  if (!user) throw new Error("The onboarding E2E user was not provisioned.");
  return user;
}

async function gotoOnboarding(page: Page) {
  await signIn(page, requireUser());
  await page.goto("/onboarding");

  // The page resolves onboarding status on the client, so a completed account
  // is replaced with /dashboard AFTER `goto` resolves. Wait for either the
  // wizard or that redirect before deciding; checking the URL immediately races
  // the status request and used to fail on a reused account.
  const wizardReady = page
    .getByText("New User Setup")
    .first()
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => undefined);
  const dashboardReady = page
    .waitForURL(/\/dashboard/, { timeout: 30_000 })
    .catch(() => undefined);
  await Promise.race([wizardReady, dashboardReady]);

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

test.beforeAll(async ({ browser }) => {
  if (!hasApp) return;

  try {
    user = await createFreshUser(browser);
  } catch (error) {
    provisionError = error instanceof Error ? error : new Error(String(error));
  }
});

test.afterAll(async ({ browser }) => {
  if (!user) return;

  if (KEEP_USER) {
    console.log(
      `[e2e] keeping onboarding user ${user.email} / ${user.password}`,
    );
    return;
  }

  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  try {
    await signIn(page, user);
    // The app's own deletion cascade removes plans, wizard sessions, the
    // organization and finally the user. `confirmOrganization=true` is the
    // acknowledgement the endpoint requires when the user owns an organization.
    const response = await page.request.delete(
      "/api/profile/delete?confirmOrganization=true",
    );
    if (!response.ok()) {
      throw new Error(
        `Failed to delete ${
          user.email
        }: ${response.status()} ${await response.text()}`,
      );
    }
    console.log(`[e2e] deleted onboarding user ${user.email}`);
  } finally {
    await context.close();
  }
});

test.describe("onboarding authentication", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");

  test("redirects an anonymous visitor to sign-in", async ({ page }) => {
    await page.goto("/onboarding");

    await expect(page).toHaveURL(/\/signin/);
  });

  test("rejects an incorrect Early Access code", async ({ page }) => {
    await page.goto("/signin");
    const dialog = inviteDialog(page);
    await expect(dialog).toBeVisible({ timeout: 20_000 });

    // Retry until hydrated: a pre-hydration click has no handler and no alert.
    // The modal owns an inline `role="alert"` because the app's Toaster is not
    // mounted while the gate is open.
    await expect(async () => {
      await fillInviteCode(dialog, "11111");
      await dialog.getByRole("button", { name: "Enter Code" }).click();
      await expect(dialog.getByRole("alert")).toHaveText(
        "Incorrect invite code",
        { timeout: 2_000 },
      );
    }).toPass({ timeout: 30_000 });

    await expect(dialog).toBeVisible();
  });

  test("accepts 22222 and reveals the sign-in form", async ({ page }) => {
    await page.goto("/signin");
    const dialog = inviteDialog(page);
    await expect(dialog).toBeVisible({ timeout: 20_000 });

    await expect(async () => {
      await fillInviteCode(dialog, EARLY_ACCESS_CODE);
      await dialog.getByRole("button", { name: "Enter Code" }).click();
      await expect(dialog).toBeHidden({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    await expect(page.getByPlaceholder("Enter your email")).toBeVisible();
  });
});

test.describe("onboarding on a phone", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");

  test.use({ viewport: { width: 390, height: 844 } });

  test("shows the desktop-only notice instead of the wizard", async ({
    page,
  }) => {
    await signIn(page, requireUser());
    await page.goto("/onboarding");

    await expect(
      page.getByText("PlanTelligence setup works best on a computer"),
    ).toBeVisible();
  });
});

test.describe("onboarding wizard", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");

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

  test("completes the full flow and reaches the dashboard", async ({
    page,
  }) => {
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
    await expect(
      page.getByRole("heading", { name: "Review Your Information" }),
    ).toBeVisible();
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
    await expect(
      page.getByRole("heading", { name: "Invite Your Team", level: 2 }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Invite Later" }).click();

    // The confirmation is a dialog; scope Continue to it so the step's own
    // footer buttons cannot collide with the modal's.
    const inviteLaterDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Invite your team later?" });
    await expect(inviteLaterDialog).toBeVisible();
    await inviteLaterDialog.getByRole("button", { name: "Continue" }).click();

    // ── Completion ───────────────────────────────────────────────────────
    await expect(page.getByText("Setup Complete!")).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  });
});
