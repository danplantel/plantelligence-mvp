import { describe, expect, it } from "vitest";

import {
  canonicalContactCategory,
  mergeContactCategoryLists,
} from "../benefit-contacts";

/**
 * The category label a contact card shows.
 *
 * Portal visibility speaks in hub keys (`Other`), while a participant-facing
 * card says `Other Benefits`; `canonicalContactCategory` is the translation, and
 * `mergeContactCategoryLists` is what produces the "Retirement · Group Health"
 * tag on a multi-hub contact — canonical order, no duplicates, unknown labels
 * kept but pushed to the end.
 */

describe("canonicalContactCategory", () => {
  it("maps each stored spelling onto the contact-facing label", () => {
    expect(canonicalContactCategory("Retirement")).toBe("Retirement");
    expect(canonicalContactCategory("Group Health")).toBe("Group Health");
    expect(canonicalContactCategory("Group Life")).toBe("Group Life");
    expect(canonicalContactCategory("Other")).toBe("Other Benefits");
    expect(canonicalContactCategory("Other Benefits")).toBe("Other Benefits");
    expect(canonicalContactCategory("Company / Plan Sponsor")).toBe(
      "Company / Plan Sponsor",
    );
    expect(canonicalContactCategory("Third Party Contact")).toBe(
      "Third Party Contact",
    );
  });

  it("ignores case and surrounding whitespace", () => {
    expect(canonicalContactCategory("  retirement  ")).toBe("Retirement");
    expect(canonicalContactCategory("other")).toBe("Other Benefits");
  });

  it("passes an unknown label through, trimmed", () => {
    expect(canonicalContactCategory("  Pet Insurance ")).toBe("Pet Insurance");
  });

  it("returns an empty string for empty input", () => {
    expect(canonicalContactCategory("")).toBe("");
    expect(canonicalContactCategory(null)).toBe("");
    expect(canonicalContactCategory(undefined)).toBe("");
  });
});

describe("mergeContactCategoryLists", () => {
  it("unions the two lists", () => {
    expect(
      mergeContactCategoryLists(["Retirement"], ["Group Life"]),
    ).toEqual(["Retirement", "Group Life"]);
  });

  it("de-duplicates case-insensitively, keeping the canonical spelling", () => {
    expect(
      mergeContactCategoryLists(["retirement"], ["Retirement", "Other"]),
    ).toEqual(["Retirement", "Other Benefits"]);
  });

  it("orders the known categories consistently regardless of input order", () => {
    expect(
      mergeContactCategoryLists(["Other", "Group Life"], ["Group Health", "Retirement"]),
    ).toEqual(["Retirement", "Group Health", "Group Life", "Other Benefits"]);
  });

  it("keeps unknown labels after the known ones, in their original order", () => {
    expect(
      mergeContactCategoryLists(["Pet Insurance", "Other"], ["Wellness"]),
    ).toEqual(["Other Benefits", "Pet Insurance", "Wellness"]);
  });

  it("drops blanks", () => {
    expect(mergeContactCategoryLists(["", "  "], ["Retirement"])).toEqual([
      "Retirement",
    ]);
  });
});
