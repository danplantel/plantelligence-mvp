import { expect, type Page, test } from "@playwright/test";

/**
 * Header & Sidebar E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1);
 *  - E2E_EMAIL / E2E_PASSWORD for the chrome journeys;
 *  - E2E_COLLABORATOR_EMAIL / E2E_COLLABORATOR_PASSWORD for the
 *    collaborator-nav journey.
 *
 * Everything skips cleanly when unconfigured.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const collaboratorEmail = process.env.E2E_COLLABORATOR_EMAIL;
const collaboratorPassword = process.env.E2E_COLLABORATOR_PASSWORD;

const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const hasCredentials = !!email && !!password;
const hasCollaborator = !!collaboratorEmail && !!collaboratorPassword;

async function signIn(page: Page, userEmail: string, userPassword: string) {
  await page.goto("/signin");
  await page.getByPlaceholder("Enter your email").fill(userEmail);
  await page.getByPlaceholder("Enter your password").fill(userPassword);
  await page.getByRole("button", { name: /continue with email/i }).click();
  await page.waitForURL(/\/dashboard|\/onboarding|\/benefits/, {
    timeout: 30_000,
  });
}

test.describe("sidebar", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run authenticated E2E",
  );

  test("keeps the collapsed rail across a reload", async ({ page }) => {
    await signIn(page, email!, password!);
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(
      page.getByRole("button", { name: "Expand sidebar" }),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByRole("button", { name: "Expand sidebar" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCSS(
      "width",
      "64px",
    );
  });

  test("collapses beside the preview editor without losing the preference", async ({
    page,
  }) => {
    await signIn(page, email!, password!);
    await page.goto("/dashboard");

    await expect(
      page.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeVisible();

    // The Preview pages dispatch this real event when their inline editor opens.
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("previewEditorLayoutChange", {
          detail: { isOpen: true },
        }),
      );
    });

    await expect(
      page.getByRole("button", { name: "Expand sidebar" }),
    ).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCSS(
      "width",
      "64px",
    );

    await page.reload();

    await expect(
      page.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeVisible();
  });
});

test.describe("header", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run authenticated E2E",
  );

  test("portals the Settings tab strip into the header", async ({ page }) => {
    await signIn(page, email!, password!);
    await page.goto("/settings");

    await expect(
      page.locator("#header-tabs-portal [role='tablist']"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("tab", { name: "Profile" }),
    ).toBeVisible();
  });
});

test.describe("collaborator chrome", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCollaborator,
    "Set E2E_COLLABORATOR_EMAIL / E2E_COLLABORATOR_PASSWORD to run this journey",
  );

  test("only shows destinations the collaborator may reach", async ({
    page,
  }) => {
    await signIn(page, collaboratorEmail!, collaboratorPassword!);
    await page.goto("/benefits");

    await expect(
      page.getByRole("navigation", { name: "Main" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Dashboard/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Plans/ }),
    ).toBeVisible();
  });
});
