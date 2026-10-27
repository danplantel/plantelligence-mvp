import { describe, expect, it } from "vitest";
import { suggestCustomStarterSet } from "@/lib/topics/library-keywords";

describe("suggestCustomStarterSet", () => {
  it("picks Financial Wellness for a financial hub, not Wellness", () => {
    // "wellness" appears in both set names, so the longer phrase must win.
    const suggestion = suggestCustomStarterSet("Financial Wellness");

    expect(suggestion?.setId).toBe("financial_wellness");
    expect(suggestion?.matchedKeyword).toBe("financial wellness");
    expect(suggestion?.topics.length).toBeGreaterThan(0);
  });

  it("suggests Wellness for an EAP or mental-health hub", () => {
    expect(suggestCustomStarterSet("EAP")?.setId).toBe("wellness");
    expect(suggestCustomStarterSet("Mental Health Resources")?.setId).toBe(
      "wellness",
    );
  });

  it("suggests Voluntary Benefits for a supplemental hub", () => {
    expect(suggestCustomStarterSet("Voluntary Benefits")?.setId).toBe("voluntary");
    expect(suggestCustomStarterSet("Pet Insurance")?.setId).toBe("voluntary");
  });

  it("is case and punctuation insensitive", () => {
    expect(suggestCustomStarterSet("  FINANCIAL  WELLNESS ")?.setId).toBe(
      "financial_wellness",
    );
  });

  it("returns null rather than guessing", () => {
    expect(suggestCustomStarterSet("Acme Perks")).toBeNull();
    expect(suggestCustomStarterSet("")).toBeNull();
    expect(suggestCustomStarterSet(null)).toBeNull();
    expect(suggestCustomStarterSet(undefined)).toBeNull();
  });

  it("returns the library entries that the set would place", () => {
    const suggestion = suggestCustomStarterSet("Wellness");

    expect(suggestion?.topics.map((topic) => topic.slug)).toContain("eap");
    expect(
      suggestion?.topics.every((topic) => topic.starterSet === "wellness"),
    ).toBe(true);
  });
});
