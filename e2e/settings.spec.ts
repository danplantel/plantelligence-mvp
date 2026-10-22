import {
  expect,
  type Browser,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

/**
 * Settings E2E.
 *
 * Prerequisite: an app reachable at E2E_BASE_URL, or E2E_START_SERVER=1 to let
 * Playwright start `pnpm dev`.
 *
 * Every page is behind the client-side Early Access gate, so the helpers enter
 * the real code (22222) through the modal.
 *
 * The account is provisioned through the real signup UI and then has its
 * onboarding completed through the wizard's own API: `middleware.ts` only lets
 * a user whose `WizardSession.completed` row exists reach `/settings`, and these
 * journeys need none of the wizard's data. `afterAll` signs in and deletes the
 * account through `DELETE /api/profile/delete?confirmOrganization=true`. No
 * `E2E_EMAIL` / `E2E_PASSWORD` is read; set `E2E_KEEP_USER=1` to keep the
 * account for inspection.
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
 * Enter the real Early Access gate when it is up.
 *
 * `ready` is what the destination page shows once the app is past the gate —
 * the sign-in form on `/signin`, the tab bar on `/settings`. Racing against it
 * keeps a call on an already-accepted context instant instead of waiting out
 * two 20-second timeouts. The interaction is retried because dev's first paint
 * can be visible before React hydrates (a pre-hydration click has no handler).
 */
async function enterEarlyAccessCode(
  page: Page,
  ready: Locator,
  code = EARLY_ACCESS_CODE,
) {
  const dialog = inviteDialog(page);

  await Promise.race([
    dialog
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined),
    ready
      .first()
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
  await enterEarlyAccessCode(page, page.getByPlaceholder("Enter your email"));
  await page.getByPlaceholder("Enter your email").fill(credentials.email);
  await page
    .getByPlaceholder("Enter your password", { exact: true })
    .fill(credentials.password);
  await page.getByRole("button", { name: /continue with email/i }).click();
  // `toHaveURL` polls the current URL; `waitForURL` also waits for the
  // navigation's `load` event, which the dev server can leave pending long
  // enough to time out even though the URL already matches.
  await expect(page).toHaveURL(/\/onboarding|\/dashboard|\/benefits/, {
    timeout: 30_000,
  });
}

/** Create the throwaway account and open the onboarding gate for it. */
async function createSettingsUser(browser: Browser): Promise<TestUser> {
  const stamp = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const credentials: TestUser = {
    name: "E2E Settings",
    email: `settings-e2e+${stamp}@plantelligence.test`,
    // Requires uppercase, lowercase, number and special character.
    password: `E2e!Pass1${stamp}`,
  };

  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  try {
    // Go straight to the sign-up page. Clicking the sign-in page's link was a
    // pre-hydration race: the link is server-rendered, so a click before React
    // attaches its handler does nothing and the URL never changes. The link
    // itself is covered by the unit suite and by the auth journeys.
    await page.goto("/signup");
    await enterEarlyAccessCode(page, page.getByPlaceholder("Enter your name"));

    await page.getByPlaceholder("Enter your name").fill(credentials.name);
    await page.getByPlaceholder("Enter your email").fill(credentials.email);
    await page
      .getByPlaceholder("Enter your password", { exact: true })
      .fill(credentials.password);
    await page
      .getByPlaceholder("Re-enter your password")
      .fill(credentials.password);

    // Sign Up stays disabled until every field is valid, so waiting for it to
    // enable is also the signal that the form hydrated and kept the fills.
    const signUp = page.getByRole("button", { name: "Sign Up" });
    await expect(signUp).toBeEnabled({ timeout: 20_000 });
    await signUp.click();

    await expect(page).toHaveURL(/\/onboarding|\/signin/, { timeout: 30_000 });
    if (!/\/onboarding/.test(page.url())) {
      await signIn(page, credentials);
    }

    // The account exists from this point, even if the assertions below fail;
    // record it so teardown can still delete it.
    user = credentials;

    // Open the middleware's onboarding gate the way finishing the wizard does:
    // a WizardSession with `completed: true`. Both routes need only the session
    // cookie, so this works even though the JWT still says incomplete — the
    // next sign-in recomputes that latch from the database.
    const sessionResponse = await page.request.post(
      "/api/onboarding-wizard/session",
    );
    if (!sessionResponse.ok()) {
      throw new Error(
        `Could not open a wizard session: ${sessionResponse.status()} ${await sessionResponse.text()}`,
      );
    }
    const completeResponse = await page.request.post(
      "/api/onboarding-wizard/complete",
      { data: {} },
    );
    if (!completeResponse.ok()) {
      throw new Error(
        `Could not complete onboarding: ${completeResponse.status()} ${await completeResponse.text()}`,
      );
    }

    console.log(`[e2e] created settings user ${credentials.email}`);
    return credentials;
  } finally {
    await context.close();
  }
}

function requireUser(): TestUser {
  if (provisionError) throw provisionError;
  if (!user) throw new Error("The settings E2E user was not provisioned.");
  return user;
}

/** Sign in as the provisioned account and land on Settings with the tab bar up. */
async function openSettings(page: Page, path = "/settings") {
  await signIn(page, requireUser());
  await page.goto(path);
  await enterEarlyAccessCode(page, page.getByRole("tab", { name: "Profile" }));
  await expect(page.getByRole("tab", { name: "Profile" })).toBeVisible({
    timeout: 30_000,
  });
}

/** The Profile tab's two fields the journeys edit. */
function profileFields(page: Page) {
  return {
    name: page.getByPlaceholder("Enter your full name"),
    organizationEmail: page.getByPlaceholder("your.organization@example.com"),
  };
}

function unsavedDialog(page: Page) {
  return page.getByRole("alertdialog");
}

test.describe("settings access", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");

  test("an anonymous settings visit is sent to sign-in with a callbackUrl", async ({
    page,
  }) => {
    await page.goto("/settings");

    await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(
      "/settings",
    );
  });
});

test.describe("settings", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");

  test.beforeAll(async ({ browser }) => {
    if (!hasApp) return;
    try {
      user = await createSettingsUser(browser);
    } catch (error) {
      provisionError =
        error instanceof Error ? error : new Error(String(error));
    }
  });

  test.afterAll(async ({ browser }) => {
    if (!hasApp || !user) return;

    if (KEEP_USER) {
      console.log(
        `[e2e] keeping settings user ${user.email} / ${user.password}`,
      );
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
      console.log(`[e2e] deleted settings user ${user.email}`);
    } finally {
      await context.close();
    }
  });

  test("an owner sees every tab and the Billing placeholder", async ({
    page,
  }) => {
    await openSettings(page);

    for (const name of [
      "Profile",
      "Branding",
      "Organization",
      "People & Access",
      "Billing",
    ]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }

    await page.getByRole("tab", { name: "Billing" }).click();

    await expect(page.getByText("Coming Soon")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Billing" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // The placeholder exists so the tab does not read as broken.
    await expect(page.getByText(/isn.t available yet/)).toBeVisible();
  });

  test("a tab deep link opens that tab and an unknown one is ignored", async ({
    page,
  }) => {
    await openSettings(page, "/settings?tab=members");
    await expect(
      page.getByRole("tab", { name: "People & Access" }),
    ).toHaveAttribute("aria-selected", "true");

    await page.goto("/settings?tab=nope");
    await expect(page.getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("saving the Profile tab persists across a reload", async ({ page }) => {
    await openSettings(page);
    const { name, organizationEmail } = profileFields(page);
    await expect(name).toBeVisible();

    const savedName = `E2E Settings ${unique().slice(0, 8)}`;
    const savedEmail = `settings-${unique().slice(0, 8)}@acme.test`;
    await name.fill(savedName);
    // The organization email is required, so it has to be filled for the save
    // to reach the server at all.
    await organizationEmail.fill(savedEmail);

    await expect(page.getByText("You have unsaved changes")).toBeVisible();
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(
      page.getByText("User profile updated successfully!"),
    ).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(page.getByPlaceholder("Enter your full name")).toHaveValue(
      savedName,
      { timeout: 30_000 },
    );
    await expect(
      page.getByPlaceholder("your.organization@example.com"),
    ).toHaveValue(savedEmail);
  });

  test("leaving a dirty Profile tab prompts, and Discard reverts the edit", async ({
    page,
  }) => {
    await openSettings(page);
    const { name } = profileFields(page);
    await expect(name).toBeVisible();
    const original = await name.inputValue();

    await name.fill(`${original} edited`);
    await expect(page.getByText("You have unsaved changes")).toBeVisible();

    await page.getByRole("tab", { name: "Branding" }).click();
    const dialog = unsavedDialog(page);
    // Scoped to the heading: the description also contains "unsaved changes".
    await expect(
      dialog.getByRole("heading", { name: "Unsaved Changes" }),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Cancel keeps the edit, not just the tab.
    await expect(name).toHaveValue(`${original} edited`);

    await page.getByRole("tab", { name: "Branding" }).click();
    await unsavedDialog(page)
      .getByRole("button", { name: "Discard & Leave" })
      .click();
    await expect(page.getByRole("tab", { name: "Branding" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByRole("tab", { name: "Profile" }).click();
    await expect(page.getByPlaceholder("Enter your full name")).toHaveValue(
      original,
    );
  });

  test("Save & Continue stays on the tab when the save cannot validate", async ({
    page,
  }) => {
    await openSettings(page);
    const { organizationEmail } = profileFields(page);
    await expect(organizationEmail).toBeVisible();

    // Dirty AND invalid: the tab's dirty check compares values, so typing an
    // address and clearing it again would read as "unchanged". An address with
    // no `@` stays a change and fails the save handler's own validation.
    await organizationEmail.fill("not-an-email");
    await expect(page.getByText("You have unsaved changes")).toBeVisible();

    await page.getByRole("tab", { name: "Branding" }).click();
    const dialog = unsavedDialog(page);
    await dialog.getByRole("button", { name: "Save & Continue" }).click();

    // The form error and the toast both carry this text.
    await expect(
      page.getByText("Please enter a valid organization email").first(),
    ).toBeVisible({ timeout: 30_000 });
    // Nothing was written, so the dialog stays open and the tab does not move.
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("the Delete Profile dialog stays locked until the phrase is typed", async ({
    page,
  }) => {
    await openSettings(page);

    await page.getByRole("button", { name: "Delete My Profile" }).click();
    const dialog = page.getByRole("alertdialog");
    // Scoped to the heading: the description repeats the same phrase in a
    // sentence.
    await expect(
      dialog.getByRole("heading", { name: "Delete Your Profile?" }),
    ).toBeVisible();

    const phrase = dialog.getByPlaceholder("delete profile");
    const confirm = dialog.getByRole("button", {
      name: "Yes, Delete My Profile",
    });

    await expect(confirm).toBeDisabled();

    await phrase.fill("delete");
    await expect(confirm).toBeDisabled();

    await phrase.fill("delete profile");
    await expect(confirm).toBeEnabled();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    // Reopening starts locked again: the phrase is cleared on every close.
    await page.getByRole("button", { name: "Delete My Profile" }).click();
    await expect(page.getByPlaceholder("delete profile")).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Yes, Delete My Profile" }),
    ).toBeDisabled();
  });
});
