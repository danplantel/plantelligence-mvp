import { expect, type Page, type Response, test } from "@playwright/test";

/**
 * Browse Benefits E2E.
 *
 * Prerequisites:
 *  - an app reachable at E2E_BASE_URL (or E2E_START_SERVER=1);
 *  - E2E_EMAIL / E2E_PASSWORD for the advisor journeys;
 *  - E2E_PLAN_NAME (optional) for the selected-plan journeys;
 *  - E2E_SECOND_PLAN_NAME (optional) for the plan-switch journey;
 *  - E2E_COLLABORATOR_EMAIL / E2E_COLLABORATOR_PASSWORD (optional) for the
 *    collaborator journey;
 *  - E2E_BENEFIT_TOGGLE=1 (optional) to run the mutating publish/hide journey.
 *
 * Everything skips cleanly when unconfigured.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const planName = process.env.E2E_PLAN_NAME;
const secondPlanName = process.env.E2E_SECOND_PLAN_NAME;
const collaboratorEmail = process.env.E2E_COLLABORATOR_EMAIL;
const collaboratorPassword = process.env.E2E_COLLABORATOR_PASSWORD;
const allowToggle = process.env.E2E_BENEFIT_TOGGLE === "1";

const hasApp =
  !!process.env.E2E_BASE_URL || process.env.E2E_START_SERVER === "1";
const hasCredentials = !!email && !!password;
const hasPlan = !!planName;
const hasSecondPlan = !!planName && !!secondPlanName;
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

function benefitsCall(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/benefits" &&
      response.request().method() === "GET",
    { timeout: 30_000 },
  );
}

function planListCall(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/clients" &&
      new URL(response.url()).searchParams.get("summary") === "1" &&
      response.request().method() === "GET",
    { timeout: 30_000 },
  );
}

async function openBenefits(page: Page) {
  const benefits = benefitsCall(page);
  const planList = planListCall(page);
  await page.goto("/benefits");
  await Promise.all([benefits, planList]);
  await expect(
    page.getByRole("heading", { name: "Benefits", level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search plans" }),
  ).toBeVisible();
}

async function selectPlan(page: Page, name: string) {
  const input = page.getByRole("textbox", { name: "Search plans" });
  await input.click();
  await input.fill(name);

  const option = page.getByRole("option", { name, exact: true }).first();
  await expect(option).toBeVisible();
  await option.click();

  await expect(
    page.getByRole("heading", { name, exact: true }).first(),
  ).toBeVisible({ timeout: 20_000 });
}

test.describe("benefits shell", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the advisor journeys",
  );

  test("renders the picker, organization strip and plan card", async ({
    page,
  }) => {
    await signIn(page, email!, password!);
    await openBenefits(page);

    await expect(page.getByText("Your organization offers")).toBeVisible();
    await expect(page.getByRole("button", { name: /Open Portal/ })).toHaveCount(
      0,
    );
    await expect(page.getByText(/Couldn't load your plans/)).toHaveCount(0);
    await expect(
      page.getByText(/Couldn't load this plan's benefits/),
    ).toHaveCount(0);

    // Either the selected plan's card or one of the explicit empty states.
    await expect(
      page
        .getByText(
          /No plans yet\.|No active plans\.|No benefits found for this plan\.|Complete|Incomplete|Not created/,
        )
        .first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("does not refetch every plan's benefits when the plan changes", async ({
    page,
  }) => {
    test.skip(
      !hasSecondPlan,
      "Set E2E_PLAN_NAME and E2E_SECOND_PLAN_NAME to run this journey",
    );

    await signIn(page, email!, password!);
    await openBenefits(page);

    let benefitsRequests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/benefits") {
        benefitsRequests += 1;
      }
    });

    await selectPlan(page, planName!);
    const before = benefitsRequests;

    await selectPlan(page, secondPlanName!);
    await page.waitForTimeout(750);

    expect(benefitsRequests).toBe(before);
  });
});

test.describe("benefits selected plan", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCredentials,
    "Set E2E_EMAIL / E2E_PASSWORD to run the advisor journeys",
  );
  test.skip(!hasPlan, "Set E2E_PLAN_NAME to run the selected-plan journeys");

  test("restores the selected plan after a reload", async ({ page }) => {
    await signIn(page, email!, password!);
    await openBenefits(page);

    await selectPlan(page, planName!);
    await page.reload();

    await expect(
      page.getByRole("heading", { name: planName!, exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("opens a benefit page from View", async ({ page }) => {
    await signIn(page, email!, password!);
    await openBenefits(page);
    await selectPlan(page, planName!);

    const view = page.getByRole("button", { name: "View" }).first();
    const viewCount = await page.getByRole("button", { name: "View" }).count();
    test.skip(viewCount === 0, "This plan has no created benefit rows");

    await view.click();
    await expect(page).toHaveURL(/\/edit-benefit\/.+\/.+/);
  });

  test("toggles a disposable benefit off and back on", async ({ page }) => {
    test.skip(
      !allowToggle,
      "Set E2E_BENEFIT_TOGGLE=1 to run the mutating publish/hide journey",
    );

    await signIn(page, email!, password!);
    await openBenefits(page);
    await selectPlan(page, planName!);

    const toggle = page.getByRole("switch").first();
    await expect(toggle).toBeVisible();
    const initial = await toggle.getAttribute("aria-checked");

    await toggle.click();
    await expect(page.getByText(/published|hidden/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(toggle).not.toHaveAttribute("aria-checked", initial ?? "");

    // Restore the original state.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", initial ?? "");
  });
});

test.describe("benefits collaborator", () => {
  test.skip(!hasApp, "Set E2E_BASE_URL (or E2E_START_SERVER=1) to run E2E");
  test.skip(
    !hasCollaborator,
    "Set E2E_COLLABORATOR_EMAIL / E2E_COLLABORATOR_PASSWORD to run this journey",
  );

  test("hides the organization strip and publish controls", async ({
    page,
  }) => {
    await signIn(page, collaboratorEmail!, collaboratorPassword!);
    await openBenefits(page);

    await expect(page.getByText("Your organization offers")).toHaveCount(0);
    await expect(page.getByRole("switch")).toHaveCount(0);
    await expect(page.getByText(/Couldn't load your plans/)).toHaveCount(0);
  });
});
