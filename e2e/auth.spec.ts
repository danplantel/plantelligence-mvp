import {
  expect,
  type Browser,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

/**
 * Authentication E2E.
 *
 * Prerequisite: an app reachable at E2E_BASE_URL, or E2E_START_SERVER=1 to let
 * Playwright start `pnpm dev`.
 *
 * Every page is behind the client-side Early Access gate, so the helpers enter
 * the real code (22222) through the modal. The authenticated journeys use a
 * throwaway account created through /signup and deleted through
 * DELETE /api/profile/delete; both happen in hooks scoped to the authenticated
 * describe, so the public "auth pages" tests never spend a signup. No
 * E2E_EMAIL / E2E_PASSWORD is read. Set E2E_KEEP_USER=1 to keep the account.
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

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
 * `InviteCodeProvider` shows the invite modal until the correct code is
 * accepted. It is client-side state, so each fresh context must pass it once.
 * The interaction is retried because dev's first paint can be visible before
 * React hydrates (a pre-hydration click has no handler).
 */
async function enterEarlyAccessCode(page: Page, code = EARLY_ACCESS_CODE) {
  const dialog = inviteDialog(page);
  const emailField = page.getByPlaceholder("Enter your email");

  await Promise.race([
    dialog
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined),
    emailField
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined),
  ]);

  if (!(await dialog.isVisible().catch(() => false))) return;

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
  await page
    .getByPlaceholder("Enter your password", { exact: true })
    .fill(credentials.password);
  await page.getByRole("button", { name: /continue with email/i }).click();
  await page.waitForURL(/\/onboarding|\/dashboard|\/benefits/, {
    timeout: 30_000,
  });
}

/** Create the throwaway account through the real signup UI. */
async function createFreshUser(browser: Browser): Promise<TestUser> {
  const stamp = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const credentials: TestUser = {
    name: "E2E Auth",
    email: `auth-e2e+${stamp}@plantelligence.test`,
    // Requires uppercase, lowercase, number and special character.
    password: `E2e!Pass1${stamp}`,
  };

  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
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

    await page.waitForURL(/\/onboarding|\/signin/, { timeout: 30_000 });
    if (!/\/onboarding/.test(page.url())) {
      await signIn(page, credentials);
    }

    // The account exists from this point, even if the assertion below fails;
    // record it so teardown can still delete it.
    user = credentials;

    await expect(page.getByText("New User Setup").first()).toBeVisible({
      timeout: 30_000,
    });
    console.log(`[e2e] created auth user ${credentials.email}`);
    return credentials;
  } finally {
    await context.close();
  }
}

function requireUser(): TestUser {
  if (provisionError) throw provisionError;
  if (!user) throw new Error("The auth E2E user was not provisioned.");
  return user;
}

test.describe("auth pages", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");

  test("an anonymous dashboard visit is sent to sign-in with a callbackUrl", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(
      "/dashboard",
    );
  });

  test("an anonymous settings visit keeps the deep link in the callbackUrl", async ({
    page,
  }) => {
    await page.goto("/settings/profile");

    await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(
      "/settings/profile",
    );
  });

  test("sign-in offers credentials, Google, sign-up, and forgot-password", async ({
    page,
  }) => {
    await page.goto("/signin");
    await enterEarlyAccessCode(page);

    await expect(page.getByPlaceholder("Enter your email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with google/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create New Account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Forgot Password?" }),
    ).toBeVisible();
  });

  test("sign-in rejects an invalid email before contacting the server", async ({
    page,
  }) => {
    let credentialsRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/auth/callback/credentials")) {
        credentialsRequests += 1;
      }
    });

    await page.goto("/signin");
    await enterEarlyAccessCode(page);

    const emailInput = page.getByPlaceholder("Enter your email");
    await emailInput.fill("not-an-email");
    await page.getByRole("button", { name: /continue with email/i }).click();

    // The input is `type="email"`, so the browser's native constraint
    // validation blocks the submit before React Hook Form can paint its Zod
    // message. Assert that native state, and that no credentials request left.
    expect(
      await emailInput.evaluate(
        (el: HTMLInputElement) => el.validity.typeMismatch,
      ),
    ).toBe(true);
    expect(
      await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage),
    ).not.toBe("");
    expect(credentialsRequests).toBe(0);
  });

  test("sign-in shows a friendly message for bad credentials", async ({
    page,
  }) => {
    await page.goto("/signin");
    await enterEarlyAccessCode(page);

    await page
      .getByPlaceholder("Enter your email")
      .fill(`nobody-${unique()}@example.com`);
    await page
      .getByPlaceholder("Enter your password", { exact: true })
      .fill("WrongPass1!");
    await page.getByRole("button", { name: /continue with email/i }).click();

    await expect(
      page.getByText("Invalid email or password. Please try again."),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("sign-up enforces the shared password policy", async ({ page }) => {
    await page.goto("/signup");
    await enterEarlyAccessCode(page);

    await page.getByPlaceholder("Enter your name").fill("E2E Person");
    await page
      .getByPlaceholder("Enter your email")
      .fill(`new-${unique()}@example.com`);
    await page
      .getByPlaceholder("Enter your password", { exact: true })
      .fill("weak");
    await page.getByPlaceholder("Re-enter your password").fill("weak");

    await expect(
      page.getByText("Password must be at least 8 characters"),
    ).toBeVisible();
  });

  test("forgot-password is reachable and validates the email", async ({
    page,
  }) => {
    let forgetRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/forget")) forgetRequests += 1;
    });

    await page.goto("/forget");
    await enterEarlyAccessCode(page);

    const emailInput = page.getByPlaceholder("Enter your email");
    await expect(emailInput).toBeVisible();
    await emailInput.fill("bad");
    await page.getByRole("button", { name: /forget password/i }).click();

    // Native `type="email"` validation blocks the submit before the form's Zod
    // resolver runs, so assert the native state and that nothing was posted.
    expect(
      await emailInput.evaluate(
        (el: HTMLInputElement) => el.validity.typeMismatch,
      ),
    ).toBe(true);
    expect(
      await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage),
    ).not.toBe("");
    expect(forgetRequests).toBe(0);
  });

  test("the reset endpoint refuses a request without a verified token", async ({
    request,
  }) => {
    const response = await request.post("/api/reset-password", {
      data: {
        email: "nobody@example.com",
        newPassword: "Str0ng!Pass",
      },
    });

    expect(response.status()).toBe(401);
    expect((await response.json()).error).toMatch(/token/i);
  });

  test("forgot-password returns a neutral response for unknown emails", async ({
    request,
  }) => {
    const response = await request.post("/api/forget", {
      data: { email: `missing-${unique()}@example.com` },
    });

    expect(response.status()).toBe(200);
    expect((await response.json()).message).toMatch(/if that email exists/i);
  });
});

test.describe("authenticated sign-in", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");

  test.beforeAll(async ({ browser }) => {
    if (!hasApp) return;
    try {
      user = await createFreshUser(browser);
    } catch (error) {
      provisionError =
        error instanceof Error ? error : new Error(String(error));
    }
  });

  test.afterAll(async ({ browser }) => {
    if (!hasApp || !user) return;

    if (KEEP_USER) {
      console.log(`[e2e] keeping auth user ${user.email} / ${user.password}`);
      return;
    }

    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    try {
      await signIn(page, user);
      // The app's own cascade removes plans, wizard sessions, the organization
      // and finally the user.
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
      console.log(`[e2e] deleted auth user ${user.email}`);
    } finally {
      await context.close();
    }
  });

  test("valid credentials leave the sign-in page", async ({ page }) => {
    await signIn(page, requireUser());

    await expect(page).not.toHaveURL(/\/signin$/);
  });

  test("a callbackUrl deep link is honoured after signing in", async ({
    page,
  }) => {
    const credentials = requireUser();
    await page.goto("/signin?callbackUrl=%2Fsettings");
    await enterEarlyAccessCode(page);

    await page.getByPlaceholder("Enter your email").fill(credentials.email);
    await page
      .getByPlaceholder("Enter your password", { exact: true })
      .fill(credentials.password);
    await page.getByRole("button", { name: /continue with email/i }).click();

    await page.waitForURL(/\/settings|\/onboarding|\/dashboard/, {
      timeout: 30_000,
    });
  });

  test("an already signed-in visitor with a callbackUrl skips the form", async ({
    page,
  }) => {
    await signIn(page, requireUser());

    await page.goto("/signin?callbackUrl=%2Fdashboard");

    await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 30_000 });
  });
});
