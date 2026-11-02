import { describe, expect, it } from "vitest";
import {
  designationAcronym,
  designationTitle,
} from "@/config/onboarding/designations";

describe("designationTitle", () => {
  it("names the acronym first, then the credential it abbreviates", () => {
    expect(designationTitle("CFP")).toBe("CFP® — Certified Financial Planner");
  });

  it("resolves a legacy label to the same pair", () => {
    expect(designationTitle("Certified Financial Planner")).toBe(
      "CFP® — Certified Financial Planner",
    );
  });

  it("keeps a free-text designation exactly as typed", () => {
    // Nothing to expand — and it never gains a mark it was not given.
    expect(designationTitle("Board Certified")).toBe("Board Certified");
    expect(designationAcronym("Board Certified")).toBe("Board Certified");
  });

  it("does not repeat a designation whose acronym has no mark", () => {
    expect(designationTitle("CFA")).toBe("CFA — Chartered Financial Analyst");
  });

  it("returns nothing for an empty value", () => {
    expect(designationTitle("")).toBe("");
  });
});
