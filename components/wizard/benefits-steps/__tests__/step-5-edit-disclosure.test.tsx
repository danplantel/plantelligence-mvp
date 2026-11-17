import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsStep5 } from "@/components/wizard/benefits-steps/step-5";

/**
 * Edit Benefit → Disclosures (and Create Benefit → Step 5) with the REAL
 * `DisclosureFooterEditor`.
 *
 * The sibling `step-5.test.tsx` stubs the editor so it can inspect the props this
 * step hands it — which means it can never catch what the radios do. Here the
 * shared editor runs for real against this surface's own text plumbing
 * (`ensurePlanTelligenceTrademark` on the way in, `stripDisclaimerCopyright` on
 * the way out), and that round trip is why returning to "Add my own" used to lose
 * the category's custom disclosure.
 */

const mocks = vi.hoisted(() => {
  const state: any = { stepData: { step1: {}, step5: {} } };
  const reset = (
    step1: Record<string, unknown> = {},
    step5: Record<string, unknown> = {},
  ) => {
    state.stepData = { step1, step5 };
    state.saveStepData = vi.fn((step: number, data: any) => {
      state.stepData = { ...state.stepData, [`step${step}`]: data };
    });
  };
  return {
    state,
    reset,
    fetchProfileOnce: vi.fn(async (): Promise<any> => null),
    fetchClientOnce: vi.fn(async (): Promise<any> => null),
    invalidateClientCache: vi.fn(),
  };
});

vi.mock("@/lib/benefits-wizard-store", () => ({
  useBenefitsWizardStore: () => mocks.state,
}));

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: mocks.fetchProfileOnce,
}));

vi.mock("@/lib/fetch-client", () => ({
  fetchClientOnce: mocks.fetchClientOnce,
  invalidateClientCache: mocks.invalidateClientCache,
}));

// The editor renders a benefit footer around its textarea; only the node matters
// here, and the real footer pulls in the portal tree.
vi.mock("@/components/layout/footer", () => ({
  Footer: ({ disclosureNode }: any) => <footer>{disclosureNode}</footer>,
}));

const CATEGORY_TEXT = "Our own retirement disclosure.";

const storedRetirement = (text: string) => ({
  id: "d-1",
  text,
  locations: ["Retirement Plan"],
  customLocation: "",
  scope: "plan",
  apply_all_benefits_categories: false,
});

function planStep1() {
  return {
    planId: "plan-1",
    benefitCategory: "Retirement",
    selectedPlan: {
      companyName: "Acme Corp",
      brandColor: "#111111",
      secondaryColor: "#222222",
      branding: { organizationName: "Acme Holdings" },
      disclaimers: {
        byCategory: { Retirement: storedRetirement(CATEGORY_TEXT) },
      },
    },
  };
}

function renderStep() {
  return render(<BenefitsStep5 />);
}

beforeEach(() => {
  mocks.reset(planStep1());
  mocks.fetchProfileOnce.mockResolvedValue({
    organizationName: "Profile Org",
    disclaimer: null,
  });
  mocks.fetchClientOnce.mockResolvedValue(null);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({}) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BenefitsStep5 — the Disclosure section", () => {
  it("names the section, like every other Disclosure editor", async () => {
    renderStep();

    expect(
      await screen.findByRole("heading", { name: "Edit Disclosure" }),
    ).toBeInTheDocument();
  });

  it("restores this category's own disclosure after a trip through Use Default", async () => {
    const user = userEvent.setup();
    renderStep();

    const textarea = await screen.findByLabelText("Disclosure Text");
    expect(textarea).toHaveValue(CATEGORY_TEXT);
    expect(screen.getByRole("radio", { name: /Add my own/i })).toBeChecked();

    // Peek at the platform copy…
    await user.click(screen.getByRole("radio", { name: /Use Default/i }));
    expect(screen.getByRole("radio", { name: /Use Default/i })).toBeChecked();
    expect(screen.getByLabelText("Disclosure Text")).not.toHaveValue(
      CATEGORY_TEXT,
    );

    // …and back: the category's words, not an empty box.
    await user.click(screen.getByRole("radio", { name: /Add my own/i }));
    expect(screen.getByRole("radio", { name: /Add my own/i })).toBeChecked();
    expect(screen.getByLabelText("Disclosure Text")).toHaveValue(CATEGORY_TEXT);
  });

  it("restores the copy when the default carries the profile's merge fields", async () => {
    // The default an advisor actually has: their own Settings text, with
    // `[Organization Name]` / `[Company Name]` in it. This step substitutes those
    // when the text comes back out of its store, so after "Use Default" the field
    // no longer equals `defaultText` — the exact case where comparing the two made
    // Edit Benefit keep the platform copy and lose the category's disclosure.
    mocks.fetchProfileOnce.mockResolvedValue({
      organizationName: "Profile Org",
      disclaimer: [
        {
          id: "p-1",
          text: "Profile defaults for [Organization Name] and [Company Name]",
          locations: ["Global"],
        },
      ],
    });
    const user = userEvent.setup();
    renderStep();

    expect(await screen.findByLabelText("Disclosure Text")).toHaveValue(
      CATEGORY_TEXT,
    );

    await user.click(screen.getByRole("radio", { name: /Use Default/i }));
    const platformCopy = screen.getByLabelText("Disclosure Text");
    // Their own default copy, merge fields resolved — different text from the one
    // the editor handed over, which is why equality could not be the test.
    expect(platformCopy).toHaveValue(
      "Profile defaults for Profile Org and Acme Corp",
    );

    await user.click(screen.getByRole("radio", { name: /Add my own/i }));
    expect(screen.getByLabelText("Disclosure Text")).toHaveValue(CATEGORY_TEXT);
  });

  it("keeps the space the advisor types in the Add my own editor", async () => {
    // The textarea's value is re-derived from the plan on every keystroke. Loading
    // it through a strip that `trimEnd()`s deleted the space as it was typed, so
    // the space key looked dead.
    const user = userEvent.setup();
    renderStep();

    const textarea = await screen.findByLabelText("Disclosure Text");
    await user.clear(textarea);
    await user.type(textarea, "Two words");

    expect(screen.getByLabelText("Disclosure Text")).toHaveValue("Two words");
  });
});
