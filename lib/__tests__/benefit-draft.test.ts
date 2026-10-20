import { beforeEach, describe, expect, it } from "vitest";

import {
  normalizeBenefitCategoryKey,
  toApiBenefitCategory,
} from "@/lib/benefit-draft";
import {
  BENEFITS_WIZARD_STORAGE_KEY,
  readPersistedBenefitsDraft,
} from "@/lib/benefits-wizard-store";

describe("normalizeBenefitCategoryKey", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normalizeBenefitCategoryKey("  Company   /  Plan Sponsor ")).toBe(
      "company / plan sponsor",
    );
    expect(normalizeBenefitCategoryKey(null)).toBe("");
    expect(normalizeBenefitCategoryKey(undefined)).toBe("");
  });
});

describe("toApiBenefitCategory", () => {
  it("maps the wizard's Custom alias to the stored hub label", () => {
    expect(toApiBenefitCategory("Custom")).toBe("Company / Plan Sponsor");
  });

  it("leaves every other category untouched", () => {
    expect(toApiBenefitCategory("Retirement")).toBe("Retirement");
    expect(toApiBenefitCategory("Group Health")).toBe("Group Health");
    expect(toApiBenefitCategory("")).toBe("");
  });
});

describe("readPersistedBenefitsDraft", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function persistDraft(payload: unknown) {
    window.localStorage.setItem(
      BENEFITS_WIZARD_STORAGE_KEY,
      typeof payload === "string" ? payload : JSON.stringify(payload),
    );
  }

  it("returns the plan and category from a persisted wizard draft", () => {
    persistDraft({
      state: {
        stepData: {
          step1: { planId: " plan-1 ", benefitCategory: " Retirement " },
        },
      },
    });

    expect(readPersistedBenefitsDraft()).toEqual({
      planId: "plan-1",
      benefitCategory: "Retirement",
    });
  });

  it("returns null when there is no stored draft", () => {
    expect(readPersistedBenefitsDraft()).toBeNull();
  });

  it("returns null when the plan or category is missing", () => {
    persistDraft({ state: { stepData: { step1: { planId: "plan-1" } } } });
    expect(readPersistedBenefitsDraft()).toBeNull();

    persistDraft({
      state: { stepData: { step1: { benefitCategory: "Retirement" } } },
    });
    expect(readPersistedBenefitsDraft()).toBeNull();
  });

  it("returns null for unreadable JSON instead of inventing a draft", () => {
    persistDraft("{not json");
    expect(readPersistedBenefitsDraft()).toBeNull();
  });
});
