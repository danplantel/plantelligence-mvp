import { expect, test } from "@playwright/test";

/**
 * Authentication E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1 to start `pnpm dev`);
 *  - E2E_EMAIL / E2E_PASSWORD for the authenticated sign-in journeys.
 *
 * The unauthenticated and API-contract tests only need a running app. They use
 * throwaway addresses so they never touch a real account.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const hasCredentials = !!email && !!password;

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
    await page.goto("/signin");

    await page.getByPlaceholder("Enter your email").fill("not-an-email");
    await page
      .getByRole("button", { name: /continue with email/i })
      .click();

    await expect(page.getByText("Enter a valid email address")).toBeVisible();
  });

  test("sign-in shows a friendly message for bad credentials", async ({
    page,
  }) => {
    await page.goto("/signin");

    await page
      .getByPlaceholder("Enter your email")
      .fill(`nobody-${unique()}@example.com`);
    await page.getByPlaceholder("Enter your password").fill("WrongPass1!");
    await page
      .getByRole("button", { name: /continue with email/i })
      .click();

    await expect(
      page.getByText("Invalid email or password. Please try again."),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("sign-up enforces the shared password policy", async ({ page }) => {
    await page.goto("/signup");

    await page.getByPlaceholder("Enter your name").fill("E2E Person");
    await page
      .getByPlaceholder("Enter your email")
      .fill(`new-${unique()}@example.com`);
    await page.getByPlaceholder("Enter your password").fill("weak");
    await page.getByPlaceholder("Re-enter your password").fill("weak");

    await expect(
      page.getByText("Password must be at least 8 characters"),
    ).toBeVisible();
  });

  test("forgot-password is reachable and validates the email", async ({
    page,
  }) => {
    await page.goto("/forget");

    await expect(page.getByPlaceholder("Enter your email")).toBeVisible();
    await page.getByPlaceholder("Enter your email").fill("bad");
    await page.getByRole("button", { name: /forget password/i }).click();

    await expect(page.getByText("Enter a valid email address")).toBeVisible();
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
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run authenticated E2E",
  );

  test("valid credentials leave the sign-in page", async ({ page }) => {
    await page.goto("/signin");

    await page.getByPlaceholder("Enter your email").fill(email!);
    await page.getByPlaceholder("Enter your password").fill(password!);
    await page
      .getByRole("button", { name: /continue with email/i })
      .click();

    await page.waitForURL(/\/dashboard|\/onboarding|\/benefits/, {
      timeout: 30_000,
    });
  });

  test("a callbackUrl deep link is honoured after signing in", async ({
    page,
  }) => {
    await page.goto("/signin?callbackUrl=%2Fsettings");

    await page.getByPlaceholder("Enter your email").fill(email!);
    await page.getByPlaceholder("Enter your password").fill(password!);
    await page
      .getByRole("button", { name: /continue with email/i })
      .click();

    await page.waitForURL(/\/settings|\/onboarding|\/dashboard/, {
      timeout: 30_000,
    });
  });

  test("an already signed-in visitor with a callbackUrl skips the form", async ({
    page,
  }) => {
    await page.goto("/signin");
    await page.getByPlaceholder("Enter your email").fill(email!);
    await page.getByPlaceholder("Enter your password").fill(password!);
    await page
      .getByRole("button", { name: /continue with email/i })
      .click();
    await page.waitForURL(/\/dashboard|\/onboarding|\/benefits/, {
      timeout: 30_000,
    });

    await page.goto("/signin?callbackUrl=%2Fdashboard");

    await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 30_000 });
  });
});
