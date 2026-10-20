import { describe, expect, it } from "vitest";

import {
  DESIGNATIONS,
  designationAcronym,
  designationAcronyms,
  designationLabel,
  designationLabels,
  getDesignationOptions,
  getRelevantDesignations,
  resolveDesignationId,
  resolveDesignationIds,
} from "../designations";

/**
 * The professional-designation dictionary behind the contact cards' acronym
 * chips (`designationAcronym`) and the onboarding picker.
 *
 * The rules worth pinning are the mark rules — a credential either carries ®,
 * ™ or nothing, and free text must never gain a mark it did not have — plus the
 * title → group routing that decides which suggestions a new contact sees.
 */

describe("DESIGNATIONS dictionary", () => {
  it("gives every designation an id, a label, an acronym and at least one group", () => {
    for (const designation of DESIGNATIONS) {
      expect(designation.value).toBeTruthy();
      expect(designation.label).toBeTruthy();
      expect(designation.acronym).toBeTruthy();
      expect(designation.groups.length).toBeGreaterThan(0);
    }
  });

  it("stores each designation id once", () => {
    const ids = DESIGNATIONS.map((designation) => designation.value);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("designationAcronym", () => {
  it("maps a stored id to its acronym including the mark", () => {
    expect(designationAcronym("CFP")).toBe("CFP®");
    expect(designationAcronym("CLU")).toBe("CLU®");
    expect(designationAcronym("SHRM_CP")).toBe("SHRM-CP®");
  });

  it("maps a legacy full label to the same acronym", () => {
    expect(designationAcronym("Certified Financial Planner")).toBe("CFP®");
    expect(designationAcronym("Accredited Investment Fiduciary")).toBe("AIF®");
  });

  it("accepts typed acronyms with or without the mark, in any case", () => {
    expect(designationAcronym("cfp")).toBe("CFP®");
    expect(designationAcronym("CFP®")).toBe("CFP®");
    expect(designationAcronym("  shrm-cp  ")).toBe("SHRM-CP®");
  });

  it("keeps the credentials that never take a mark unbranded", () => {
    expect(designationAcronym("CFA")).toBe("CFA");
    expect(designationAcronym("CIPM")).toBe("CIPM");
    expect(designationAcronym("GBA")).toBe("GBA");
    expect(designationAcronym("RPA")).toBe("RPA");
    expect(designationAcronym("QPA")).toBe("QPA");
  });

  it("keeps the ™ mark on the HRCI international credentials", () => {
    expect(designationAcronym("APHRI")).toBe("aPHRi™");
    expect(designationAcronym("PHRI")).toBe("PHRi™");
    expect(designationAcronym("SPHRI")).toBe("SPHRi™");
  });

  it("passes unknown free text through unchanged, never adding a mark", () => {
    expect(designationAcronym("Fancy Designation")).toBe("Fancy Designation");
    expect(designationAcronym("CPE")).toBe("CPE");
  });

  it("returns an empty string for an empty value", () => {
    expect(designationAcronym("")).toBe("");
  });

  it("filters blanks when mapping a list and drops them from the output", () => {
    expect(designationAcronyms(["CFP", "", "AIF"])).toEqual(["CFP®", "AIF®"]);
    expect(designationAcronyms(null)).toEqual([]);
  });
});

describe("designationLabel", () => {
  it("expands a stored id to its full label", () => {
    expect(designationLabel("CFP")).toBe("Certified Financial Planner");
    expect(designationLabel("SHRM_CP")).toBe("SHRM Certified Professional");
  });

  it("leaves free text alone and maps a list", () => {
    expect(designationLabel("Something Custom")).toBe("Something Custom");
    expect(designationLabels(["CFP", "", "Something Custom"])).toEqual([
      "Certified Financial Planner",
      "Something Custom",
    ]);
  });
});

describe("resolveDesignationId", () => {
  it("resolves a legacy reworded label to its canonical id", () => {
    expect(resolveDesignationId("CFA® – Chartered Financial Analyst")).toBe(
      "CFA",
    );
    expect(
      resolveDesignationId(
        "CIPM® – Certificate in Investment Performance Measurement",
      ),
    ).toBe("CIPM");
  });

  it("keeps unknown free text and normalizes a list", () => {
    expect(resolveDesignationId("Something Custom")).toBe("Something Custom");
    expect(
      resolveDesignationIds(["cfp", "", "Certified Financial Planner"]),
    ).toEqual(["CFP", "CFP"]);
  });
});

describe("getDesignationOptions", () => {
  it("returns a copy of the whole dictionary when no group is given", () => {
    const options = getDesignationOptions();
    expect(options).toHaveLength(DESIGNATIONS.length);
    options.pop();
    expect(DESIGNATIONS).toHaveLength(options.length + 1);
  });

  it("restricts the list to one group", () => {
    const hr = getDesignationOptions("hr");
    expect(hr.every((designation) => designation.groups.includes("hr"))).toBe(
      true,
    );
    expect(hr.map((designation) => designation.value)).toContain("SHRM_CP");
    expect(hr.map((designation) => designation.value)).not.toContain("CFP");
  });
});

describe("getRelevantDesignations", () => {
  it("suggests nothing for relationship / client-success roles", () => {
    expect(getRelevantDesignations("Relationship Manager")).toEqual([]);
    expect(getRelevantDesignations("Client Success Lead")).toEqual([]);
    expect(getRelevantDesignations("")).toEqual([]);
  });

  it("routes recordkeeper / TPA / compliance titles to the TPA group", () => {
    for (const title of [
      "Recordkeeper",
      "TPA Administrator",
      "Plan Administrator",
      "Compliance Analyst",
      "Operations Specialist",
    ]) {
      expect(getRelevantDesignations(title).map((d) => d.value)).toEqual(
        getDesignationOptions("recordkeeper_tpa").map((d) => d.value),
      );
    }
  });

  it("routes HR titles to the HR group", () => {
    expect(
      getRelevantDesignations("HR Business Partner").map((d) => d.value),
    ).toEqual(getDesignationOptions("hr").map((d) => d.value));
  });

  it("checks benefits before advisor, so a benefits advisor gets benefits credentials", () => {
    expect(
      getRelevantDesignations("Benefits Advisor").map((d) => d.value),
    ).toEqual(getDesignationOptions("benefits_insurance").map((d) => d.value));
  });

  it("routes advisor / planner / wealth titles to retirement & wealth", () => {
    expect(
      getRelevantDesignations("Retirement Plan Advisor").map((d) => d.value),
    ).toEqual(getDesignationOptions("retirement_wealth").map((d) => d.value));
  });

  it("offers the whole dictionary when the title matches nothing", () => {
    expect(getRelevantDesignations("Marketing Lead")).toHaveLength(
      DESIGNATIONS.length,
    );
  });
});
