import { describe, expect, it } from "vitest";

import {
  categoriesToStep2Services,
  normalizePrimaryServiceCategories,
  step2ServicesToCategories,
} from "@/lib/service-categories";
import { ServiceType } from "@/types/wizard";

describe("normalizePrimaryServiceCategories", () => {
  it("returns an empty list for non-arrays and empty values", () => {
    expect(normalizePrimaryServiceCategories(null)).toEqual([]);
    expect(normalizePrimaryServiceCategories(undefined)).toEqual([]);
    expect(normalizePrimaryServiceCategories("Retirement")).toEqual([]);
    expect(
      normalizePrimaryServiceCategories([null, undefined, "", "   "]),
    ).toEqual([]);
  });

  it("trims and de-duplicates repeated labels", () => {
    expect(
      normalizePrimaryServiceCategories([
        " Retirement ",
        "Retirement",
        "",
        "  ",
      ]),
    ).toEqual(["Retirement"]);
  });

  it("orders canonical labels by the display order", () => {
    expect(
      normalizePrimaryServiceCategories([
        "Other",
        "Group Life",
        "Group Health",
        "Retirement",
      ]),
    ).toEqual(["Retirement", "Group Health", "Group Life", "Other"]);
  });

  it("keeps unknown stored labels after the canonical ones", () => {
    expect(
      normalizePrimaryServiceCategories(["Dental", "Retirement", "Vision"]),
    ).toEqual(["Retirement", "Dental", "Vision"]);
  });
});

describe("step2ServicesToCategories", () => {
  it("maps every supported Step 2 service to its category label", () => {
    expect(
      step2ServicesToCategories([
        ServiceType.RETIREMENT,
        ServiceType.GROUP_HEALTH,
        ServiceType.GROUP_LIFE_DISABILITY,
        ServiceType.SUPPLEMENTAL_HEALTH,
        ServiceType.OTHER,
      ]),
    ).toEqual(["Retirement", "Group Health", "Group Life", "Other"]);
  });

  it("de-duplicates labels when several services fold onto one category", () => {
    expect(
      step2ServicesToCategories([
        ServiceType.SUPPLEMENTAL_HEALTH,
        ServiceType.OTHER,
      ]),
    ).toEqual(["Other"]);
  });

  it("drops unknown service values instead of inventing labels", () => {
    expect(
      step2ServicesToCategories([
        "not-a-service",
        ServiceType.RETIREMENT,
        "",
      ]),
    ).toEqual(["Retirement"]);
  });
});

describe("categoriesToStep2Services", () => {
  it("maps labels back to service enum values and de-duplicates", () => {
    expect(
      categoriesToStep2Services([
        "Retirement",
        "Group Health",
        "Group Life",
        "Other",
      ]),
    ).toEqual([
      ServiceType.RETIREMENT,
      ServiceType.GROUP_HEALTH,
      ServiceType.GROUP_LIFE_DISABILITY,
      ServiceType.OTHER,
    ]);
  });

  it("passes through an unknown label unchanged", () => {
    expect(categoriesToStep2Services(["Dental"])).toEqual(["Dental"]);
  });
});
