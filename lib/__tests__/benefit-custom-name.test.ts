import { describe, expect, it } from "vitest";

import {
  BENEFIT_TITLE_MAX_LENGTH,
  CUSTOM_BENEFIT_CATEGORY,
  CUSTOM_BENEFIT_LEGACY_SLUG,
  customBenefitNameToSlug,
  customBenefitRouteSlug,
  displayCategoryName,
  isCustomBenefitRouteSegment,
  isCustomHubCategory,
  isPlaceholderBenefitName,
} from "../benefit-custom-name";

/**
 * The Custom benefit's name doubles as its portal URL, so these helpers decide
 * three things at once: what heading a participant reads, which `Benefit.title`
 * counts as "a real name", and which route segment resolves to the hub.
 *
 * Two values are indistinguishable from a real name in the database — the
 * storage label (`"Company / Plan Sponsor"`) and the intro-headline default
 * (`"Welcome to …"`) — and both must read as "not named yet" rather than
 * rendering as a heading or a URL.
 */

describe("isCustomHubCategory", () => {
  it("recognises every spelling of the Custom hub", () => {
    expect(isCustomHubCategory(CUSTOM_BENEFIT_CATEGORY)).toBe(true);
    expect(isCustomHubCategory("company/plan sponsor")).toBe(true);
    expect(isCustomHubCategory("Custom")).toBe(true);
    expect(isCustomHubCategory("  CUSTOM  ")).toBe(true);
  });

  it("does not claim the other hubs", () => {
    expect(isCustomHubCategory("Retirement")).toBe(false);
    expect(isCustomHubCategory("Group Health")).toBe(false);
    expect(isCustomHubCategory("")).toBe(false);
    expect(isCustomHubCategory(null)).toBe(false);
  });
});

describe("isPlaceholderBenefitName", () => {
  it("treats an empty or missing name as a placeholder", () => {
    expect(isPlaceholderBenefitName("")).toBe(true);
    expect(isPlaceholderBenefitName("   ")).toBe(true);
    expect(isPlaceholderBenefitName(null)).toBe(true);
    expect(isPlaceholderBenefitName(undefined)).toBe(true);
  });

  it("treats the storage label as a placeholder", () => {
    expect(isPlaceholderBenefitName(CUSTOM_BENEFIT_CATEGORY)).toBe(true);
    expect(isPlaceholderBenefitName("Custom")).toBe(true);
  });

  it("treats the intro-headline default as a placeholder", () => {
    expect(isPlaceholderBenefitName("Welcome to your benefits")).toBe(true);
    expect(isPlaceholderBenefitName("welcome to Acme")).toBe(true);
  });

  it("accepts a name the advisor actually chose", () => {
    expect(isPlaceholderBenefitName("Mindfulness and Me")).toBe(false);
    expect(isPlaceholderBenefitName("Pet Insurance")).toBe(false);
  });
});

describe("customBenefitNameToSlug", () => {
  it("lowercases, hyphenates and trims", () => {
    expect(customBenefitNameToSlug("Mindfulness and Me")).toBe(
      "mindfulness-and-me",
    );
    expect(customBenefitNameToSlug("  Pet  Insurance  ")).toBe("pet-insurance");
  });

  it("drops punctuation and collapses separators", () => {
    expect(customBenefitNameToSlug("Mindfulness & Me!")).toBe("mindfulness-me");
    expect(customBenefitNameToSlug("A/B -- C")).toBe("a-b-c");
  });

  it("returns an empty slug when there is nothing nameable", () => {
    expect(customBenefitNameToSlug("")).toBe("");
    expect(customBenefitNameToSlug("!!!")).toBe("");
    expect(customBenefitNameToSlug(null)).toBe("");
  });
});

describe("customBenefitRouteSlug", () => {
  it("uses the name's slug when there is one", () => {
    expect(customBenefitRouteSlug("Mindfulness and Me")).toBe(
      "mindfulness-and-me",
    );
  });

  it("falls back to the legacy segment rather than linking to the root", () => {
    expect(customBenefitRouteSlug("")).toBe(CUSTOM_BENEFIT_LEGACY_SLUG);
    expect(customBenefitRouteSlug(null)).toBe(CUSTOM_BENEFIT_LEGACY_SLUG);
  });
});

describe("isCustomBenefitRouteSegment", () => {
  it("accepts the legacy segment for any plan", () => {
    expect(
      isCustomBenefitRouteSegment(CUSTOM_BENEFIT_LEGACY_SLUG, "Mindfulness"),
    ).toBe(true);
    expect(isCustomBenefitRouteSegment(CUSTOM_BENEFIT_LEGACY_SLUG, null)).toBe(
      true,
    );
  });

  it("accepts the plan's own name slug", () => {
    expect(
      isCustomBenefitRouteSegment("mindfulness-and-me", "Mindfulness and Me"),
    ).toBe(true);
  });

  it("decodes an escaped segment", () => {
    expect(
      isCustomBenefitRouteSegment(
        "mindfulness%20and%20me",
        "Mindfulness and Me",
      ),
    ).toBe(false);
    expect(
      isCustomBenefitRouteSegment(
        "mindfulness%2Dand%2Dme",
        "Mindfulness-and-Me",
      ),
    ).toBe(true);
  });

  it("rejects an unnamed hub's slug, which is the legacy segment only", () => {
    expect(isCustomBenefitRouteSegment("custom", CUSTOM_BENEFIT_CATEGORY)).toBe(
      false,
    );
    expect(
      isCustomBenefitRouteSegment("custom", "Welcome to your benefits"),
    ).toBe(false);
  });

  it("rejects a different hub's segment and blank input", () => {
    expect(isCustomBenefitRouteSegment("retirement", "Mindfulness")).toBe(
      false,
    );
    expect(isCustomBenefitRouteSegment("", "Mindfulness")).toBe(false);
    expect(isCustomBenefitRouteSegment(null, "Mindfulness")).toBe(false);
  });
});

describe("displayCategoryName", () => {
  it("shows the advisor's name for the Custom hub", () => {
    expect(
      displayCategoryName(CUSTOM_BENEFIT_CATEGORY, "Mindfulness and Me"),
    ).toBe("Mindfulness and Me");
  });

  it("says Custom while the hub has no name", () => {
    expect(displayCategoryName(CUSTOM_BENEFIT_CATEGORY, "")).toBe("Custom");
    expect(
      displayCategoryName(CUSTOM_BENEFIT_CATEGORY, "Welcome to your benefits"),
    ).toBe("Custom");
  });

  it("names every other category after itself", () => {
    expect(displayCategoryName("Retirement", "Retirement Plan Benefits")).toBe(
      "Retirement",
    );
    expect(displayCategoryName("Group Health", "")).toBe("Group Health");
  });

  it("keeps the title cap the wizard enforces", () => {
    expect(BENEFIT_TITLE_MAX_LENGTH).toBe(35);
  });
});
