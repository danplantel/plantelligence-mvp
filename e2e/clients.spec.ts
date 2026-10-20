import { expect, type Page, type Response, test } from "@playwright/test";

/**
 * All Plans (View Clients) E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1);
 *  - E2E_EMAIL / E2E_PASSWORD for the owner journeys;
 *  - E2E_PLAN_NAME (optional) for the row journeys — any plan the owner can see.
 *
 * Everything skips cleanly when unconfigured. The journeys assert the network
 * contract (`view=table`, the filter/sort params) as well as what the table
 * shows, because the page keeps its filters in memory and the URL never changes.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const planName = process.env.E2E_PLAN_NAME;

const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const hasCredentials = !!email && !!password;
const hasPlan = !!planName;

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
 * Resolve on the next `GET /api/clients` response the predicate accepts.
 *
 * Register the promise BEFORE the action that triggers the request.
 */
function clientsApiCall(
  page: Page,
  predicate: (url: URL) => boolean,
): Promise<Response> {
  return page.waitForResponse(
    (response) => {
      if (!response.url().includes("/api/clients?")) return false;
      if (response.request().method() !== "GET") return false;
      return predicate(new URL(response.url()));
    },
    { timeout: 30_000 },
  );
}

async function openClients(page: Page) {
  const initial = clientsApiCall(page, () => true);
  await page.goto("/clients");
  await initial;
  await expect(page.getByPlaceholder("Search plans...")).toBeVisible();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("clients", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the owner journeys",
  );

  test("renders the All Plans shell", async ({ page }) => {
    await signIn(page, email!, password!);
    await openClients(page);

    await expect(
      page.getByRole("button", { name: /Advanced Filter/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Plan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();

    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Client" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Prospect" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Plan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Type" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Created" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Updated" })).toBeVisible();

    // Either at least one plan or the empty state — never the failure state.
    await expect(page.getByText(/Couldn't load plans/)).toHaveCount(0);
    await expect(
      page.getByText(/No plans found\.|contacts$/).first(),
    ).toBeVisible();
  });

  test("searching a name that cannot exist shows the empty state", async ({
    page,
  }) => {
    await signIn(page, email!, password!);
    await openClients(page);

    const searchCall = clientsApiCall(
      page,
      (url) => url.searchParams.get("search") === "zzz-no-such-plan",
    );
    await page.getByPlaceholder("Search plans...").fill("zzz-no-such-plan");

    const response = await searchCall;
    expect(response.ok()).toBeTruthy();
    expect(new URL(response.url()).searchParams.get("view")).toBe("table");

    await expect(page.getByText("No plans found.")).toBeVisible({
      timeout: 20_000,
    });
    // The new failure state must not be confused with an empty result.
    await expect(page.getByText(/Couldn't load plans/)).toHaveCount(0);
  });

  test("applies, clears and sorts from the toolbar", async ({ page }) => {
    await signIn(page, email!, password!);
    await openClients(page);

    // Quick plan-type filter.
    const prospectCall = clientsApiCall(
      page,
      (url) => url.searchParams.get("type") === "prospect",
    );
    await page.getByRole("button", { name: "Prospect" }).click();
    await prospectCall;

    // Advanced Filter → Draft.
    await page.getByRole("button", { name: /Advanced Filter/ }).click();
    const draftCall = clientsApiCall(
      page,
      (url) => url.searchParams.get("status") === "draft",
    );
    await page.getByRole("menuitemradio", { name: "Draft" }).click();
    await draftCall;

    // Reset filters clears both status and type.
    await page.getByRole("button", { name: /Advanced Filter/ }).click();
    const resetCall = clientsApiCall(
      page,
      (url) =>
        url.searchParams.get("status") === "all" &&
        url.searchParams.get("type") === "all",
    );
    await page.getByRole("menuitem", { name: "Reset filters" }).click();
    await resetCall;

    // Sorting the Plan column resets to ascending and to page 1.
    const sortCall = clientsApiCall(
      page,
      (url) =>
        url.searchParams.get("sortColumn") === "companyName" &&
        url.searchParams.get("sortDirection") === "asc",
    );
    await page.getByRole("button", { name: "Plan" }).click();
    const sortResponse = await sortCall;

    const sortParams = new URL(sortResponse.url()).searchParams;
    expect(sortParams.get("page")).toBe("1");
    expect(sortParams.get("view")).toBe("table");
  });

  test("refreshing revalidates the table projection", async ({ page }) => {
    await signIn(page, email!, password!);
    await openClients(page);

    const refreshCall = clientsApiCall(
      page,
      (url) => url.searchParams.get("view") === "table",
    );
    await page.getByRole("button", { name: "Refresh" }).click();
    await refreshCall;
  });
});

test.describe("clients row journeys", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the owner journeys",
  );
  test.skip(!hasPlan, "Set E2E_PLAN_NAME to run the plan row journeys");

  test("opens a plan's contacts tab from its contact count", async ({
    page,
  }) => {
    await signIn(page, email!, password!);
    await openClients(page);

    const searchCall = clientsApiCall(
      page,
      (url) => url.searchParams.get("search") === planName,
    );
    await page.getByPlaceholder("Search plans...").fill(planName!);
    await searchCall;

    const row = page.getByRole("row", {
      name: new RegExp(escapeRegExp(planName!)),
    });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: /contacts$/ }).click();

    await expect(page).toHaveURL(/\/edit-client\/.+\?tab=contacts/);
  });

  test("cancelling a deletion keeps the plan in place", async ({ page }) => {
    await signIn(page, email!, password!);
    await openClients(page);

    const searchCall = clientsApiCall(
      page,
      (url) => url.searchParams.get("search") === planName,
    );
    await page.getByPlaceholder("Search plans...").fill(planName!);
    await searchCall;

    const row = page.getByRole("row", {
      name: new RegExp(escapeRegExp(planName!)),
    });
    await row.getByRole("button", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(planName!)).toBeVisible();
    await expect(
      dialog.getByText(/This action cannot be undone/),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(row).toBeVisible();
  });
});
