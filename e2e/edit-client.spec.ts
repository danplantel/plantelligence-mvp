import { expect, type Page, test } from "@playwright/test";

/**
 * Edit Plan (Edit Client) E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1);
 *  - E2E_EMAIL / E2E_PASSWORD for the owner journey;
 *  - E2E_EDIT_PLAN_NAME (or E2E_PLAN_NAME) naming a plan the owner can edit;
 *  - E2E_ALLOW_EDIT=1 to run the journeys that write (a normal Save and a
 *    Portal URL rename). Those mutate the plan, so they are opt-in.
 *
 * The unit suites (`pnpm test:edit-client`) mock `useEditClient` and every tab
 * section, so this is the only layer that proves the real editor loads a plan,
 * saves it through `PUT /api/clients/:id`, and keeps the renamed URL as a
 * previous one.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const planName = process.env.E2E_EDIT_PLAN_NAME || process.env.E2E_PLAN_NAME;

const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const hasCredentials = !!email && !!password;
const hasPlan = !!planName;
const allowWrite = process.env.E2E_ALLOW_EDIT === "1";

async function signIn(page: Page, userEmail: string, userPassword: string) {
  await page.goto("/signin");
  await page.getByPlaceholder("Enter your email").fill(userEmail);
  await page.getByPlaceholder("Enter your password").fill(userPassword);
  await page.getByRole("button", { name: /continue with email/i }).click();
  await page.waitForURL(/\/dashboard|\/onboarding|\/benefits|\/clients/, {
    timeout: 30_000,
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Open the editor through All Plans (the real entry point) and return the plan
 * id from the URL, so the deep-link journey needs no second lookup.
 */
async function openPlanEditor(page: Page): Promise<string> {
  await page.goto("/clients");

  const row = page
    .getByRole("row", { name: new RegExp(escapeRegExp(planName!)) })
    .first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole("button", { name: "Edit" }).click();

  await page.waitForURL(/\/edit-client\/[^/?#]+/, { timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: "Save Changes" }),
  ).toBeVisible();

  const match = page.url().match(/\/edit-client\/([^/?#]+)/);
  return match ? match[1] : "";
}

function saveButton(page: Page) {
  return page.getByRole("button", { name: /Save Changes/ });
}

test.describe("edit-client", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the owner journeys",
  );
  test.skip(
    !hasPlan,
    "Set E2E_EDIT_PLAN_NAME (or E2E_PLAN_NAME) to pick the plan under test",
  );

  test("opens a plan and renders the editor shell", async ({ page }) => {
    await signIn(page, email!, password!);
    await openPlanEditor(page);

    // The header band names the plan being edited.
    await expect(page.getByRole("heading", { name: planName! })).toBeVisible();

    // All five tabs are portaled into the fixed header.
    for (const label of [
      "Branding",
      "Preview",
      "Key Contacts",
      "Documents",
      "Disclosures",
    ]) {
      await expect(page.getByRole("tab", { name: label })).toBeVisible();
    }

    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open Portal" }),
    ).toBeVisible();
  });

  test("opens a tab from a ?tab= deep link", async ({ page }) => {
    await signIn(page, email!, password!);
    const planId = await openPlanEditor(page);

    await page.goto(`/edit-client/${planId}?tab=contacts`);
    await expect(
      page.getByRole("button", { name: "Save Changes" }),
    ).toBeVisible();

    await expect(
      page.getByRole("tab", { name: "Key Contacts" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Branding" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  test("gates deleting the plan behind the typed phrase", async ({ page }) => {
    await signIn(page, email!, password!);
    await openPlanEditor(page);

    await page.getByRole("button", { name: /Delete Plan/ }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Delete Plan?" }),
    ).toBeVisible();

    const confirm = dialog.getByRole("button", { name: "Yes, delete" });
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel(/delete plan/i).fill("delete plan");
    await expect(confirm).toBeEnabled();

    // Back out: this journey must never delete the fixture plan.
    await dialog.getByRole("button", { name: "No, keep it" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("saves the plan and confirms it", async ({ page }) => {
    test.skip(!allowWrite, "Set E2E_ALLOW_EDIT=1 to run the write journeys");

    await signIn(page, email!, password!);
    await openPlanEditor(page);

    const putResponses: number[] = [];
    page.on("response", (response) => {
      if (
        response.request().method() === "PUT" &&
        /\/api\/clients\/[^/]+$/.test(new URL(response.url()).pathname)
      ) {
        putResponses.push(response.status());
      }
    });

    await saveButton(page).click();

    await expect(page.getByText("Client updated successfully")).toBeVisible({
      timeout: 30_000,
    });
    expect(putResponses).toContain(200);
  });

  test("renames the portal URL and keeps the old one as a previous URL", async ({
    page,
  }) => {
    test.skip(!allowWrite, "Set E2E_ALLOW_EDIT=1 to run the write journeys");

    await signIn(page, email!, password!);
    const planId = await openPlanEditor(page);

    const portalUrlInput = page.locator("#portalUrl");
    const originalSlug = await portalUrlInput.inputValue();
    expect(originalSlug).not.toBe("");

    const newSlug = `e2e-${Date.now().toString(36)}`;
    await portalUrlInput.fill(newSlug);

    await saveButton(page).click();

    // Renaming is confirmed before it is persisted, because the old URL stays
    // reserved to this plan.
    const confirmDialog = page.getByRole("dialog", {
      name: "Save with a new Portal URL?",
    });
    await expect(confirmDialog).toBeVisible({ timeout: 15_000 });
    await expect(confirmDialog.getByText("Old URL")).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Client updated successfully")).toBeVisible({
      timeout: 30_000,
    });

    // A reload proves the rename persisted and the old URL was kept as an alias.
    await page.goto(`/edit-client/${planId}`);
    await expect(page.locator("#portalUrl")).toHaveValue(newSlug, {
      timeout: 30_000,
    });
    await expect(
      page.getByText("Previous URLs", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(originalSlug, { exact: false }).first(),
    ).toBeVisible();
  });
});
