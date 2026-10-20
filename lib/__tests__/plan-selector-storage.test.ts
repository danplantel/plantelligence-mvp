import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAllPlanSelections,
  getLastPlanId,
  getRecentPlanIds,
  lastPlanStorageKey,
  persistPlanSelection,
  PLAN_RECENTS_STORAGE_KEY,
  resolveStickyPlanId,
  setLastPlanId,
  touchRecentPlan,
} from "@/lib/plan-selector-storage";

describe("plan-selector-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps per-module sticky values separate", () => {
    persistPlanSelection("benefits", "plan-benefits");
    persistPlanSelection("documents", "plan-documents");

    expect(getLastPlanId("benefits")).toBe("plan-benefits");
    expect(getLastPlanId("documents")).toBe("plan-documents");
    expect(window.localStorage.getItem(lastPlanStorageKey("benefits"))).toBe(
      "plan-benefits",
    );
  });

  it("moves a plan to the front of the global MRU and de-duplicates it", () => {
    touchRecentPlan("plan-1");
    touchRecentPlan("plan-2");
    touchRecentPlan("plan-1");

    expect(getRecentPlanIds()).toEqual(["plan-1", "plan-2"]);
  });

  it("caps the MRU at five ids", () => {
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      touchRecentPlan(id);
    }

    expect(getRecentPlanIds()).toEqual(["f", "e", "d", "c", "b"]);
  });

  it("ignores corrupt recents JSON and non-string entries", () => {
    window.localStorage.setItem(PLAN_RECENTS_STORAGE_KEY, "{not json");
    expect(getRecentPlanIds()).toEqual([]);

    window.localStorage.setItem(
      PLAN_RECENTS_STORAGE_KEY,
      JSON.stringify(["plan-1", null, 7, "", "plan-2"]),
    );
    expect(getRecentPlanIds()).toEqual(["plan-1", "plan-2"]);
  });

  it("never writes an empty plan id", () => {
    setLastPlanId("benefits", "");
    touchRecentPlan("");

    expect(getLastPlanId("benefits")).toBeNull();
    expect(getRecentPlanIds()).toEqual([]);
  });

  it("resolves a sticky plan from URL first, module memory second, then the first plan", () => {
    persistPlanSelection("benefits", "plan-sticky");
    const plans = [{ id: "plan-1" }, { id: "plan-2" }, { id: "plan-sticky" }];

    expect(resolveStickyPlanId(plans, "benefits", "plan-2")).toBe("plan-2");
    expect(resolveStickyPlanId(plans, "benefits", "missing")).toBe(
      "plan-sticky",
    );
    expect(resolveStickyPlanId(plans, "documents", null)).toBe("plan-1");
    expect(resolveStickyPlanId([], "benefits", "plan-1")).toBeNull();
  });

  it("clears per-module selections but keeps recents", () => {
    persistPlanSelection("benefits", "plan-1");
    persistPlanSelection("marketing", "plan-2");

    clearAllPlanSelections();

    expect(getLastPlanId("benefits")).toBeNull();
    expect(getLastPlanId("marketing")).toBeNull();
    expect(getRecentPlanIds()).toEqual(["plan-2", "plan-1"]);
  });
});
