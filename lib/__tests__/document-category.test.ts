import { describe, expect, it } from "vitest";

import {
  DOCUMENT_CATEGORY_HUB_SORT_ORDER,
  compareDocumentCategoriesHubOrder,
  isDocumentCategoryUnresolved,
  resolvePersistedDocumentCategory,
} from "@/lib/document-category";

describe("resolvePersistedDocumentCategory", () => {
  it("normalizes R2 slugs and common aliases", () => {
    expect(resolvePersistedDocumentCategory("Document", "retirement")).toBe(
      "Retirement",
    );
    expect(resolvePersistedDocumentCategory("Document", "group-health")).toBe(
      "Group Health",
    );
    expect(resolvePersistedDocumentCategory("Document", "group life")).toBe(
      "Group Life",
    );
    expect(resolvePersistedDocumentCategory("Document", "Other")).toBe(
      "Other Benefits",
    );
    expect(resolvePersistedDocumentCategory("Document", "General")).toBe(
      "Other Benefits",
    );
  });

  it("normalizes benefit-language aliases", () => {
    expect(
      resolvePersistedDocumentCategory("Document", "401(k) plan materials"),
    ).toBe("Retirement");
    expect(resolvePersistedDocumentCategory("Document", "health insurance")).toBe(
      "Group Health",
    );
    expect(resolvePersistedDocumentCategory("Document", "life insurance")).toBe(
      "Group Life",
    );
    expect(resolvePersistedDocumentCategory("Document", "wellness")).toBe(
      "Company / Plan Sponsor",
    );
    expect(resolvePersistedDocumentCategory("Document", "recordkeeper")).toBe(
      "Recordkeeper / Vendor",
    );
  });

  it("trims and preserves an unknown explicit category", () => {
    expect(resolvePersistedDocumentCategory("Document", "  Custom Plan  ")).toBe(
      "Custom Plan",
    );
  });

  it("infers from the document type when no category is set", () => {
    expect(resolvePersistedDocumentCategory("SPD", null)).toBe("Retirement");
    expect(resolvePersistedDocumentCategory("SBC", undefined)).toBe(
      "Group Health",
    );
  });

  it("infers from the R2 storage-key segment", () => {
    const key = (segment: string) =>
      `org/user/plans/plan/documents/${segment}/file.pdf`;

    expect(resolvePersistedDocumentCategory("Document", null, key("retirement"))).toBe(
      "Retirement",
    );
    expect(
      resolvePersistedDocumentCategory("Document", null, key("group-health")),
    ).toBe("Group Health");
    expect(resolvePersistedDocumentCategory("Document", null, key("group-life"))).toBe(
      "Group Life",
    );
    expect(resolvePersistedDocumentCategory("Document", null, key("other"))).toBe(
      "Other Benefits",
    );
  });

  it("prefers an explicit category over the type inference", () => {
    expect(resolvePersistedDocumentCategory("SPD", "Group Life")).toBe(
      "Group Life",
    );
  });

  it("falls back to Other Benefits", () => {
    expect(resolvePersistedDocumentCategory("Document", null, null)).toBe(
      "Other Benefits",
    );
  });
});

describe("isDocumentCategoryUnresolved", () => {
  it("is false for any explicit category", () => {
    expect(isDocumentCategoryUnresolved("Document", "General")).toBe(false);
  });

  it("is false when the type or storage key implies a category", () => {
    expect(isDocumentCategoryUnresolved("SPD", null)).toBe(false);
    expect(
      isDocumentCategoryUnresolved(
        "Document",
        null,
        "org/plans/documents/group-health/file.pdf",
      ),
    ).toBe(false);
  });

  it("is true when nothing implies a category", () => {
    expect(isDocumentCategoryUnresolved("Document", null)).toBe(true);
    expect(isDocumentCategoryUnresolved(null, "  ")).toBe(true);
  });
});

describe("compareDocumentCategoriesHubOrder", () => {
  it("orders the hub categories", () => {
    const sorted = [...DOCUMENT_CATEGORY_HUB_SORT_ORDER].reverse().sort(
      compareDocumentCategoriesHubOrder,
    );
    expect(sorted).toEqual([...DOCUMENT_CATEGORY_HUB_SORT_ORDER]);
  });

  it("treats empty and Other as Other Benefits", () => {
    expect(compareDocumentCategoriesHubOrder(null, "Other Benefits")).toBe(0);
    expect(compareDocumentCategoriesHubOrder("Other", "Other Benefits")).toBe(0);
  });

  it("sorts unknown categories after the known ones", () => {
    expect(
      compareDocumentCategoriesHubOrder("Retirement", "Custom Category"),
    ).toBeLessThan(0);
    expect(
      compareDocumentCategoriesHubOrder("Custom Category", "Group Health"),
    ).toBeGreaterThan(0);
  });

  it("alphabetizes ties deterministically", () => {
    expect(
      compareDocumentCategoriesHubOrder("Custom A", "Custom B"),
    ).toBeLessThan(0);
  });
});
