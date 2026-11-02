import { describe, expect, it } from "vitest";
import {
  contactServesCategory,
  isCategoryKeyContact,
  normalizePortalCategory,
  resolveFeaturedContactId,
  resolvePortalPrimaryContact,
} from "@/lib/portal-primary-contact";

const contacts = [
  // A plain plan contact, tagged with the benefit but claiming nothing.
  {
    id: "jane",
    name: "Jane Smith",
    benefitsCategory: "Retirement",
  },
  // The advisor's own row: NOT the plan's general primary, but it claims Retirement.
  {
    id: "advisor",
    name: "Eddie Taliaferro",
    isPrimary: false,
    isPrimaryOverall: false,
    isPrimaryByCategory: { Retirement: true },
    benefitsCategories: [
      "Retirement",
      "Group Health",
      "Group Life",
      "Company / Plan Sponsor",
    ],
  },
];

describe("normalizePortalCategory", () => {
  it("folds the wizard's and the API's names for the custom hub together", () => {
    expect(normalizePortalCategory("Custom")).toBe("company / plan sponsor");
    expect(normalizePortalCategory("Other")).toBe("company / plan sponsor");
    expect(normalizePortalCategory("Company / Plan Sponsor")).toBe(
      "company / plan sponsor",
    );
  });

  it("folds the legacy health/life spellings", () => {
    expect(normalizePortalCategory("Health Insurance")).toBe("group health");
    expect(normalizePortalCategory("Life Insurance")).toBe("group life");
  });
});

describe("contactServesCategory", () => {
  it("reads the single value and the list", () => {
    expect(contactServesCategory(contacts[0], "Retirement")).toBe(true);
    expect(contactServesCategory(contacts[0], "Group Health")).toBe(false);
    expect(contactServesCategory(contacts[1], "Group Life")).toBe(true);
  });

  it("ignores a missing category", () => {
    expect(contactServesCategory(contacts[0], undefined)).toBe(false);
  });
});

describe("isCategoryKeyContact", () => {
  it("honours the per-benefit claim", () => {
    expect(isCategoryKeyContact(contacts[1], "Retirement")).toBe(true);
    expect(isCategoryKeyContact(contacts[1], "Group Health")).toBe(false);
  });

  it("is false without a claim", () => {
    expect(isCategoryKeyContact(contacts[0], "Retirement")).toBe(false);
  });
});

describe("resolvePortalPrimaryContact", () => {
  it("picks the contact claiming the benefit over the first contact tagged with it", () => {
    // The bug: the advisor's row is not the plan's general primary, so the resolver
    // used to fall through to "anyone tagged with Retirement" and name a stranger.
    expect(resolvePortalPrimaryContact(contacts, "Retirement")?.id).toBe(
      "advisor",
    );
  });

  it("still prefers a general primary tagged with the category", () => {
    const list = [
      { id: "first", name: "First", benefitsCategory: "Retirement" },
      {
        id: "primary",
        name: "Primary",
        isPrimary: true,
        benefitsCategory: "Retirement",
      },
    ];
    expect(resolvePortalPrimaryContact(list, "Retirement")?.id).toBe("primary");
  });

  it("falls back to the first contact tagged with the category", () => {
    const list = [
      { id: "health", name: "Health", benefitsCategory: "Group Health" },
      { id: "retirement", name: "Retirement", benefitsCategory: "Retirement" },
    ];
    expect(resolvePortalPrimaryContact(list, "Retirement")?.id).toBe(
      "retirement",
    );
  });

  it("skips a contact hidden from the portal", () => {
    const list = [
      {
        id: "hidden",
        name: "Hidden",
        showOnPortal: false,
        isPrimaryByCategory: { Retirement: true },
        benefitsCategory: "Retirement",
      },
      { id: "shown", name: "Shown", benefitsCategory: "Retirement" },
    ];
    expect(resolvePortalPrimaryContact(list, "Retirement")?.id).toBe("shown");
  });
});

describe("resolveFeaturedContactId", () => {
  it("keeps the resolver's pick when that person has a card", () => {
    expect(
      resolveFeaturedContactId(
        [{ id: "jane" }, { id: "advisor" }],
        contacts,
        "Retirement",
      ),
    ).toBe("advisor");
  });

  it("falls back to a card tagged with the benefit when the pick is not on the row", () => {
    // The failure that left "Have Questions?" with NO featured card: the banner's
    // pick was James, who is not one of this benefit's support contacts.
    const row = [
      { id: "advisor", benefitsCategories: ["Retirement"] },
      { id: "other", benefitsCategories: ["Group Health"] },
    ];
    expect(resolveFeaturedContactId(row, contacts, "Retirement")).toBe(
      "advisor",
    );
  });

  it("returns nothing when no card covers the benefit", () => {
    const row = [{ id: "other", benefitsCategories: ["Group Health"] }];
    expect(resolveFeaturedContactId(row, contacts, "Retirement")).toBe("");
  });
});
