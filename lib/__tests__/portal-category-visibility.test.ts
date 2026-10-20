import { describe, expect, it } from "vitest";

import {
  areAllCategoriesHiddenInPortal,
  benefitCategoryToVisibilityKey,
  filterContactsByPortalVisibility,
  getCategoryPortalVisibility,
  getContactCategories,
  isCategoryVisibleInPortal,
  isContactVisibleInPortal,
  isNonHubContactCategory,
  syncBenefitsWithCategoryVisibility,
  type CategoryPortalVisibility,
} from "../portal-category-visibility";

/**
 * Portal category visibility is the switchboard between the Edit Plan
 * "Category Display" toggles and what a participant can actually see:
 *
 *  - `getCategoryPortalVisibility` normalizes whatever the database holds
 *    (object, JSON string, aliases, booleans-as-strings, garbage) into exactly
 *    the four canonical keys, and it is what both the PUT route and the portal
 *    read call, so a wrong default here silently publishes or hides a hub.
 *  - The hide rules then decide which benefit cards and key contacts survive.
 *    Two of them are deliberate and easy to break: contacts are never hidden by
 *    hiding every hub (that is the default state for a new plan), and
 *    non-hub contacts (plan sponsor, recordkeeper, external HR) are never
 *    treated as "Other Benefits" content.
 */

const ALL_VISIBLE: CategoryPortalVisibility = {
  Retirement: true,
  "Group Health": true,
  "Group Life": true,
  Other: true,
};

function visibility(
  overrides: Record<string, boolean> = {},
): CategoryPortalVisibility {
  return { ...ALL_VISIBLE, ...overrides };
}

describe("getCategoryPortalVisibility", () => {
  it("defaults to every hub visible when nothing is stored", () => {
    expect(getCategoryPortalVisibility(null)).toEqual(ALL_VISIBLE);
    expect(getCategoryPortalVisibility(undefined)).toEqual(ALL_VISIBLE);
  });

  it("keeps an explicit hide and only that one", () => {
    const result = getCategoryPortalVisibility({ Other: false });

    expect(result).toEqual({ ...ALL_VISIBLE, Other: false });
    expect(Object.keys(result)).toEqual([
      "Retirement",
      "Group Health",
      "Group Life",
      "Other",
    ]);
  });

  it("reads booleans serialized as strings and numbers", () => {
    expect(
      getCategoryPortalVisibility({
        Retirement: "false",
        "Group Health": "true",
        "Group Life": 0,
        Other: 1,
      }),
    ).toEqual({
      Retirement: false,
      "Group Health": true,
      "Group Life": false,
      Other: true,
    });
  });

  it("parses a JSON string payload", () => {
    expect(
      getCategoryPortalVisibility(
        JSON.stringify({ Retirement: false, "Group Health": false }),
      ),
    ).toEqual({
      ...ALL_VISIBLE,
      Retirement: false,
      "Group Health": false,
    });
  });

  it("falls back to all-visible for broken JSON", () => {
    expect(getCategoryPortalVisibility("{not json")).toEqual(ALL_VISIBLE);
  });

  it("falls back to all-visible for an empty string", () => {
    expect(getCategoryPortalVisibility("   ")).toEqual(ALL_VISIBLE);
  });

  it("ignores an array, which is not a key/value map", () => {
    expect(getCategoryPortalVisibility(["Retirement"])).toEqual(ALL_VISIBLE);
  });

  it("honours a lower-cased key from the database", () => {
    expect(
      getCategoryPortalVisibility({ "group health": false }),
    ).toMatchObject({ "Group Health": false });
  });

  it("honours the snake_case and no-space aliases", () => {
    expect(
      getCategoryPortalVisibility({ group_health: false, grouplife: false }),
    ).toMatchObject({ "Group Health": false, "Group Life": false });

    expect(getCategoryPortalVisibility({ group_life: false })).toMatchObject({
      "Group Life": false,
    });
  });

  it("drops unknown keys so downstream filters cannot key off them", () => {
    const result = getCategoryPortalVisibility({
      Retirement: false,
      "Something Else": false,
    });

    expect(Object.keys(result).sort()).toEqual(
      ["Group Health", "Group Life", "Other", "Retirement"].sort(),
    );
    expect(result).not.toHaveProperty("Something Else");
  });

  it("treats an unrecognised value as visible rather than hidden", () => {
    expect(getCategoryPortalVisibility({ Retirement: "maybe" })).toMatchObject({
      Retirement: true,
    });
  });
});

describe("benefitCategoryToVisibilityKey", () => {
  it("maps every benefit label to one of the four hubs", () => {
    expect(benefitCategoryToVisibilityKey("Retirement")).toBe("Retirement");
    expect(benefitCategoryToVisibilityKey("Retirement Plan Benefits")).toBe(
      "Retirement",
    );
    expect(benefitCategoryToVisibilityKey("Health Insurance")).toBe(
      "Group Health",
    );
    expect(benefitCategoryToVisibilityKey("Life Insurance")).toBe("Group Life");
    expect(benefitCategoryToVisibilityKey("Wellness Programs")).toBe("Other");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(benefitCategoryToVisibilityKey("  group health  ")).toBe(
      "Group Health",
    );
  });

  it("buckets anything unrecognised under Other", () => {
    expect(benefitCategoryToVisibilityKey("Pet Insurance")).toBe("Other");
    expect(benefitCategoryToVisibilityKey("")).toBe("Other");
  });
});

describe("syncBenefitsWithCategoryVisibility", () => {
  it("re-enables benefits whose hub was just made visible", () => {
    const benefits = [
      { category: "Retirement", isEnabled: false },
      { category: "Health Insurance", isEnabled: false },
    ];

    expect(syncBenefitsWithCategoryVisibility(benefits, visibility())).toEqual([
      { category: "Retirement", isEnabled: true },
      { category: "Health Insurance", isEnabled: true },
    ]);
  });

  it("leaves benefits in a hidden hub disabled", () => {
    const benefits = [{ category: "Other", isEnabled: false }];

    expect(
      syncBenefitsWithCategoryVisibility(
        benefits,
        visibility({ Other: false }),
      ),
    ).toEqual([{ category: "Other", isEnabled: false }]);
  });

  it("uses the mirror's title when the row has no category", () => {
    expect(
      syncBenefitsWithCategoryVisibility(
        [{ title: "Life Insurance", isEnabled: false }],
        visibility(),
      ),
    ).toEqual([{ title: "Life Insurance", isEnabled: true }]);
  });

  it("passes the list through when there is no visibility map", () => {
    const benefits = [{ category: "Retirement", isEnabled: false }];

    expect(syncBenefitsWithCategoryVisibility(benefits, null)).toBe(benefits);
    expect(syncBenefitsWithCategoryVisibility(null, visibility())).toEqual([]);
  });
});

describe("isCategoryVisibleInPortal", () => {
  it("shows everything when no visibility map is supplied", () => {
    expect(isCategoryVisibleInPortal("Retirement", null)).toBe(true);
    expect(isCategoryVisibleInPortal("Retirement", undefined)).toBe(true);
  });

  it("hides only the toggled-off hub", () => {
    const map = visibility({ "Group Life": false });

    expect(isCategoryVisibleInPortal("Life Insurance", map)).toBe(false);
    expect(isCategoryVisibleInPortal("Health Insurance", map)).toBe(true);
  });

  it("follows the Other toggle for unknown categories", () => {
    expect(
      isCategoryVisibleInPortal("Pet Insurance", visibility({ Other: false })),
    ).toBe(false);
  });
});

describe("areAllCategoriesHiddenInPortal", () => {
  it("is true only when all four hubs are explicitly hidden", () => {
    expect(
      areAllCategoriesHiddenInPortal({
        Retirement: false,
        "Group Health": false,
        "Group Life": false,
        Other: false,
      }),
    ).toBe(true);

    expect(areAllCategoriesHiddenInPortal(visibility({ Other: false }))).toBe(
      false,
    );
  });

  it("is false without a map", () => {
    expect(areAllCategoriesHiddenInPortal(null)).toBe(false);
    expect(areAllCategoriesHiddenInPortal(undefined)).toBe(false);
  });
});

describe("isNonHubContactCategory", () => {
  it("recognises the contact roles that are not benefit hubs", () => {
    expect(isNonHubContactCategory("Company / Plan Sponsor")).toBe(true);
    expect(isNonHubContactCategory("Recordkeeper / Vendor")).toBe(true);
    expect(isNonHubContactCategory("External HR / Administrator")).toBe(true);
    expect(isNonHubContactCategory("Support Team")).toBe(true);
  });

  it("does not claim the benefit hubs", () => {
    expect(isNonHubContactCategory("Retirement")).toBe(false);
    expect(isNonHubContactCategory("Other Benefits")).toBe(false);
    expect(isNonHubContactCategory(null)).toBe(false);
  });
});

describe("isContactVisibleInPortal", () => {
  it("shows every contact when all hubs are hidden (a new plan's default)", () => {
    const allHidden: CategoryPortalVisibility = {
      Retirement: false,
      "Group Health": false,
      "Group Life": false,
      Other: false,
    };

    expect(isContactVisibleInPortal(["Retirement"], allHidden)).toBe(true);
    expect(isContactVisibleInPortal(["Other"], allHidden)).toBe(true);
  });

  it("always shows uncategorised and non-hub contacts", () => {
    const onlyRetirement = visibility({
      "Group Health": false,
      "Group Life": false,
      Other: false,
    });

    expect(isContactVisibleInPortal([], onlyRetirement)).toBe(true);
    expect(
      isContactVisibleInPortal(["Company / Plan Sponsor"], onlyRetirement),
    ).toBe(true);
  });

  it("hides a contact whose only hub is switched off", () => {
    const onlyRetirement = visibility({
      "Group Health": false,
      "Group Life": false,
      Other: false,
    });

    expect(isContactVisibleInPortal(["Other Benefits"], onlyRetirement)).toBe(
      false,
    );
  });

  it("shows a multi-hub contact when any of its hubs is visible", () => {
    const onlyRetirement = visibility({
      "Group Health": false,
      "Group Life": false,
      Other: false,
    });

    expect(
      isContactVisibleInPortal(
        ["Health Insurance", "Retirement"],
        onlyRetirement,
      ),
    ).toBe(true);
  });

  it("shows everything without a visibility map", () => {
    expect(isContactVisibleInPortal(["Other"], null)).toBe(true);
  });
});

describe("getContactCategories", () => {
  it("reads the four spellings the contact surfaces use", () => {
    expect(
      getContactCategories({ benefitsCategories: ["Retirement"] }),
    ).toEqual(["Retirement"]);
    expect(getContactCategories({ benefitsCategory: "Retirement" })).toEqual([
      "Retirement",
    ]);
    expect(getContactCategories({ benefits_category: "Retirement" })).toEqual([
      "Retirement",
    ]);
    expect(
      getContactCategories({ benefits: { category: "Retirement" } }),
    ).toEqual(["Retirement"]);
  });

  it("normalizes benefit labels onto the hub keys", () => {
    expect(
      getContactCategories({ benefitsCategories: ["Health Insurance"] }),
    ).toEqual(["Group Health"]);
    expect(
      getContactCategories({
        benefitsCategories: ["Retirement Plan Benefits", "Wellness Programs"],
      }),
    ).toEqual(["Retirement", "Other"]);
  });

  it("keeps non-hub labels instead of collapsing them into Other", () => {
    expect(
      getContactCategories({
        benefitsCategories: ["Company / Plan Sponsor"],
      }),
    ).toEqual(["Company / Plan Sponsor"]);
  });

  it("de-duplicates repeated categories", () => {
    expect(
      getContactCategories({
        benefitsCategories: ["Retirement", "Retirement Plan"],
        category: "retirement",
      }),
    ).toEqual(["Retirement"]);
  });

  it("returns nothing for a missing contact", () => {
    expect(getContactCategories(null)).toEqual([]);
    expect(getContactCategories(undefined)).toEqual([]);
  });
});

describe("filterContactsByPortalVisibility", () => {
  it("drops contacts from hidden hubs and keeps the rest", () => {
    const contacts = [
      { id: "1", benefitsCategories: ["Retirement"] },
      { id: "2", benefitsCategories: ["Other Benefits"] },
      { id: "3", benefitsCategories: ["Company / Plan Sponsor"] },
    ];

    const visible = filterContactsByPortalVisibility(
      contacts,
      visibility({ Other: false }),
    );

    expect(visible.map((contact) => contact.id)).toEqual(["1", "3"]);
  });

  it("normalizes a raw visibility payload before filtering", () => {
    const contacts = [
      { id: "1", benefitsCategories: ["Retirement"] },
      { id: "2", benefitsCategories: ["Group Health"] },
    ];

    const visible = filterContactsByPortalVisibility(contacts, {
      retirement: false,
    } as unknown as CategoryPortalVisibility);

    expect(visible.map((contact) => contact.id)).toEqual(["2"]);
  });

  it("keeps every contact when all hubs are hidden", () => {
    const contacts = [
      { id: "1", benefitsCategories: ["Retirement"] },
      { id: "2", benefitsCategories: ["Other"] },
    ];

    expect(
      filterContactsByPortalVisibility(contacts, {
        Retirement: false,
        "Group Health": false,
        "Group Life": false,
        Other: false,
      }),
    ).toHaveLength(2);
  });
});
