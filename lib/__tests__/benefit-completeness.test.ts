import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getBenefitCompleteness,
  getBenefitsArrayFromPortalPreview,
  normalizeBenefitsCategoryForCompleteness,
} from "../benefit-completeness";

/**
 * `getBenefitCompleteness` decides whether a hub card is publishable. The
 * portal uses it to block a click and open the "finish this benefit" dialog, so
 * a false positive ships an empty hub and a false negative nags an advisor
 * whose hub is fine.
 *
 * Four sections must all pass: branding (a logo from the card, the category's
 * contact, or the plan), messaging (the card's own title + description — not the
 * plan's mission), contacts (a contact categorised to this hub), and documents
 * (a persisted document resolved to this hub).
 *
 * `resolvePersistedDocumentCategory` is stubbed to a pass-through so the tests
 * describe which persisted category is *trusted*, not how it is derived.
 */

vi.mock("@/lib/document-category", () => ({
  resolvePersistedDocumentCategory: (
    type: string,
    category: string | null | undefined,
  ) => category ?? type,
}));

function benefitRow(overrides: Record<string, unknown> = {}) {
  return {
    category: "Retirement",
    title: "Retirement Plan Benefits",
    description: "Everything you need to retire well.",
    partnerLogo: "https://cdn.test/partner.png",
    image: "https://cdn.test/card.png",
    ...overrides,
  };
}

function plan(overrides: Record<string, unknown> = {}) {
  return {
    employeePortalPreview: { benefits: [benefitRow()] },
    keyContacts: [
      {
        name: "Ada",
        benefitsCategories: ["Retirement"],
        companyLogo: "https://cdn.test/contact.png",
      },
    ],
    documents: [{ type: "SPD", category: "Retirement" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, "group").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "groupEnd").mockImplementation(() => {});
});

describe("normalizeBenefitsCategoryForCompleteness", () => {
  it("maps the wizard's card labels onto the canonical categories", () => {
    expect(
      normalizeBenefitsCategoryForCompleteness("Retirement Plan Benefits"),
    ).toBe("Retirement");
    expect(normalizeBenefitsCategoryForCompleteness("health insurance")).toBe(
      "Group Health",
    );
    expect(normalizeBenefitsCategoryForCompleteness("Life Insurance")).toBe(
      "Group Life",
    );
    expect(normalizeBenefitsCategoryForCompleteness("Wellness Programs")).toBe(
      "Company / Plan Sponsor",
    );
    expect(normalizeBenefitsCategoryForCompleteness("Other Benefits")).toBe(
      "Other Benefits",
    );
  });

  it("ignores case and repeated whitespace", () => {
    expect(normalizeBenefitsCategoryForCompleteness("  GROUP   HEALTH ")).toBe(
      "Group Health",
    );
  });

  it("keeps an already-canonical category in its canonical casing", () => {
    expect(normalizeBenefitsCategoryForCompleteness("group life")).toBe(
      "Group Life",
    );
  });

  it("passes an unknown label through so nothing is silently re-bucketed", () => {
    expect(normalizeBenefitsCategoryForCompleteness("Pet Insurance")).toBe(
      "Pet Insurance",
    );
    expect(normalizeBenefitsCategoryForCompleteness("   ")).toBe("");
    expect(normalizeBenefitsCategoryForCompleteness(null)).toBe("");
  });
});

describe("getBenefitsArrayFromPortalPreview", () => {
  it("prefers the nested preview snapshot over the root array", () => {
    const client = {
      employeePortalPreview: {
        benefits: [{ title: "root" }],
        previewData: { benefits: [{ title: "nested" }] },
      },
    };

    expect(getBenefitsArrayFromPortalPreview(client)).toEqual([
      { title: "nested" },
    ]);
  });

  it("falls back to the root array when the snapshot is empty", () => {
    const client = {
      employeePortalPreview: {
        benefits: [{ title: "root" }],
        previewData: { benefits: [] },
      },
    };

    expect(getBenefitsArrayFromPortalPreview(client)).toEqual([
      { title: "root" },
    ]);
  });

  it("returns an empty list when there is no preview payload", () => {
    expect(getBenefitsArrayFromPortalPreview({})).toEqual([]);
    expect(
      getBenefitsArrayFromPortalPreview({ employeePortalPreview: null }),
    ).toEqual([]);
    expect(getBenefitsArrayFromPortalPreview(null)).toEqual([]);
  });
});

describe("getBenefitCompleteness", () => {
  it("passes a benefit with branding, copy, a contact and a document", () => {
    const result = getBenefitCompleteness("Retirement" as any, plan());

    expect(result.isComplete).toBe(true);
    expect(result.missingInfo).toEqual([]);
    expect(result.sections).toEqual({
      branding: true,
      messaging: true,
      contacts: true,
      documents: true,
    });
  });

  it("flags a missing provider logo", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        employeePortalPreview: {
          benefits: [benefitRow({ partnerLogo: "" })],
        },
        keyContacts: [],
        companyLogo: "",
      }),
    );

    expect(result.sections.branding).toBe(false);
    expect(result.missingInfo).toContain("Provider logo missing");
    expect(result.isComplete).toBe(false);
  });

  it("accepts a logo that lives on the category's contact", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        employeePortalPreview: {
          benefits: [benefitRow({ partnerLogo: "" })],
        },
        companyLogo: "",
      }),
    );

    expect(result.sections.branding).toBe(true);
    expect(result.missingInfo).not.toContain("Provider logo missing");
  });

  it("accepts the plan logo and unwraps its { url } form", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        employeePortalPreview: {
          benefits: [benefitRow({ partnerLogo: "" })],
        },
        keyContacts: [],
        companyLogo: { url: "https://cdn.test/plan.png" },
      }),
    );

    expect(result.sections.branding).toBe(true);
  });

  it("does not count a placeholder asset as a logo", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        employeePortalPreview: {
          benefits: [
            benefitRow({ partnerLogo: "https://cdn.test/placeholder.png" }),
          ],
        },
        keyContacts: [],
        companyLogo: "",
      }),
    );

    expect(result.missingInfo).toContain("Provider logo missing");
  });

  it("requires the card's own header image", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        employeePortalPreview: {
          benefits: [benefitRow({ image: "", backgroundImage: "" })],
        },
        heroDescription: "a plan hero does not stand in for the card image",
      }),
    );

    expect(result.sections.branding).toBe(false);
    expect(result.missingInfo).toContain("Benefit card header image missing");
  });

  it("accepts the Benefit model's backgroundImage field", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        employeePortalPreview: {
          benefits: [
            benefitRow({
              image: "",
              backgroundImage: "https://cdn.test/bg.png",
            }),
          ],
        },
      }),
    );

    expect(result.missingInfo).not.toContain(
      "Benefit card header image missing",
    );
  });

  it("flags missing copy without treating the plan's mission as the card's", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        employeePortalPreview: {
          benefits: [benefitRow({ description: "", shortDescription: "" })],
        },
        missionBody: "The plan mission is not the card description",
      }),
    );

    expect(result.sections.messaging).toBe(false);
    expect(result.missingInfo).toContain("Description missing");
    expect(result.missingInfo).not.toContain("Custom title missing");
  });

  it("accepts shortDescription as the card copy", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        employeePortalPreview: {
          benefits: [
            benefitRow({
              description: "",
              shortDescription: "Short and sweet",
            }),
          ],
        },
      }),
    );

    expect(result.sections.messaging).toBe(true);
  });

  it("flags a card row that has no title", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        employeePortalPreview: { benefits: [benefitRow({ title: "" })] },
      }),
    );

    expect(result.missingInfo).toContain("Custom title missing");
  });

  it("flags a benefit with no coordinating contact", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        keyContacts: [{ name: "Grace", benefitsCategories: ["Group Health"] }],
      }),
    );

    expect(result.sections.contacts).toBe(false);
    expect(result.missingInfo).toContain("No support contact assigned");
  });

  it("accepts the single benefitsCategory field", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        keyContacts: [{ name: "Ada", benefitsCategory: "Retirement" }],
      }),
    );

    expect(result.sections.contacts).toBe(true);
  });

  it("flags a benefit with no document resolved to its hub", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({ documents: [{ type: "SBC", category: "Group Health" }] }),
    );

    expect(result.sections.documents).toBe(false);
    expect(result.missingInfo).toContain("Plan documents missing");
  });

  it("ignores archived documents", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        documents: [
          { type: "SPD", category: "Retirement", archivedAt: "2026-01-01" },
        ],
      }),
    );

    expect(result.sections.documents).toBe(false);
  });

  it("reads contacts from the { contacts } envelope", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        keyContacts: {
          contacts: [{ name: "Ada", benefitsCategories: ["Retirement"] }],
        },
      }),
    );

    expect(result.sections.contacts).toBe(true);
  });

  it("merges a nested companyData block before checking the plan logo", () => {
    const result = getBenefitCompleteness(
      "Retirement" as any,
      plan({
        employeePortalPreview: {
          benefits: [benefitRow({ partnerLogo: "" })],
        },
        keyContacts: [],
        companyLogo: "",
        companyData: { companyLogo: "https://cdn.test/nested-logo.png" },
      }),
    );

    expect(result.sections.branding).toBe(true);
  });

  it("reports every missing section at once", () => {
    const result = getBenefitCompleteness("Group Health" as any, {
      employeePortalPreview: { benefits: [] },
      keyContacts: [],
      documents: [],
    });

    expect(result.isComplete).toBe(false);
    expect(result.missingInfo).toEqual([
      "Provider logo missing",
      "Benefit card header image missing",
      // A missing row falls back to `{ category, title }`, so the title passes.
      "Description missing",
      "No support contact assigned",
      "Plan documents missing",
    ]);
  });
});
