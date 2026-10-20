import { describe, expect, it } from "vitest";

import {
  categoryToSlug,
  slugToCategory,
} from "@/lib/benefit-category-slug";

describe("benefit category slugs", () => {
  it.each([
    ["Retirement", "retirement"],
    ["Group Health", "group-health"],
    ["Group Life", "group-life"],
    ["Company / Plan Sponsor", "company-plan-sponsor"],
    ["Custom", "company-plan-sponsor"],
  ])("maps %s to %s", (category, slug) => {
    expect(categoryToSlug(category)).toBe(slug);
  });

  it("round-trips every canonical category through its slug", () => {
    for (const category of [
      "Retirement",
      "Group Health",
      "Group Life",
      "Company / Plan Sponsor",
    ]) {
      expect(slugToCategory(categoryToSlug(category))).toBe(category);
    }
  });

  it("resolves the legacy Custom alias to the stored hub label", () => {
    expect(slugToCategory("company-plan-sponsor")).toBe(
      "Company / Plan Sponsor",
    );
  });

  it("falls back to a lowercase hyphenated slug for unknown categories", () => {
    expect(categoryToSlug("Dental & Vision")).toBe("dental-vision");
    expect(categoryToSlug("  Group / Life  ")).toBe("group-life");
    expect(categoryToSlug("")).toBe("");
  });

  it("matches slugs case-insensitively and decodes encoded input", () => {
    expect(slugToCategory("GROUP-HEALTH")).toBe("Group Health");
    expect(slugToCategory("group%2Dhealth")).toBe("Group Health");
  });

  it("returns an unknown slug unchanged", () => {
    expect(slugToCategory("dental-vision")).toBe("dental-vision");
    expect(slugToCategory("")).toBe("");
  });
});
