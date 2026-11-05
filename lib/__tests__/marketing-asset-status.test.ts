import { describe, expect, it } from "vitest";

import {
  MARKETING_ASSET_STATUSES,
  marketingAssetStatusClass,
} from "@/lib/marketing/asset-status";

/**
 * One status list and one colour map, shared by the Marketing page and the
 * portal's News & Events panel — so "Published" cannot be green in the
 * dashboard and grey in the panel.
 */
describe("marketingAssetStatusClass", () => {
  it("gives every status its own chip", () => {
    const classes = MARKETING_ASSET_STATUSES.map(marketingAssetStatusClass);

    expect(new Set(classes).size).toBe(MARKETING_ASSET_STATUSES.length);
  });

  it("paints Published green", () => {
    expect(marketingAssetStatusClass("Published")).toContain("bg-green-50");
  });

  it("falls back to the Draft chip for a status it does not know", () => {
    // Rows predate the six-value list, and the API stores whatever it was given.
    expect(marketingAssetStatusClass("Something else")).toBe(
      marketingAssetStatusClass("Draft"),
    );
    expect(marketingAssetStatusClass(null)).toContain("bg-gray-100");
  });
});
