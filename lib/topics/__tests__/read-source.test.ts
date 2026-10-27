import { describe, expect, it } from "vitest";
import {
  isTopicFrameworkArmed,
  parsePlanAllowlist,
  resolveTopicReadSource,
} from "@/lib/topics/read-source";

describe("isTopicFrameworkArmed", () => {
  it("is false while the feature is dark", () => {
    // This is what lets the benefit GET skip the placement count entirely.
    expect(isTopicFrameworkArmed("", "")).toBe(false);
    expect(isTopicFrameworkArmed(null, undefined)).toBe(false);
    expect(isTopicFrameworkArmed(" , ", "0")).toBe(false);
  });

  it("is true when either switch is set", () => {
    expect(isTopicFrameworkArmed("plan-a", "")).toBe(true);
    expect(isTopicFrameworkArmed("", "1")).toBe(true);
    expect(isTopicFrameworkArmed(undefined, "on")).toBe(true);
  });
});

describe("parsePlanAllowlist", () => {
  it("splits, trims and drops empty entries", () => {
    expect(parsePlanAllowlist(" plan-a, plan-b ,,  ")).toEqual([
      "plan-a",
      "plan-b",
    ]);
  });

  it("returns nothing for an empty value", () => {
    expect(parsePlanAllowlist("")).toEqual([]);
    expect(parsePlanAllowlist(null)).toEqual([]);
    expect(parsePlanAllowlist(undefined)).toEqual([]);
  });
});

describe("resolveTopicReadSource", () => {
  it("always reads legacy for a plan with no placements", () => {
    expect(
      resolveTopicReadSource({
        clientId: "plan-a",
        hasPlacements: false,
        enabled: "1",
      }),
    ).toBe("legacy");
  });

  it("reads legacy without a plan id", () => {
    expect(
      resolveTopicReadSource({ clientId: "  ", hasPlacements: true, enabled: "1" }),
    ).toBe("legacy");
  });

  it("reads placements for an allowlisted plan", () => {
    expect(
      resolveTopicReadSource({
        clientId: "plan-a",
        hasPlacements: true,
        plans: "plan-a, plan-b",
      }),
    ).toBe("placements");
  });

  it("treats the allowlist as exclusive", () => {
    // A seeded plan that is not on the rollout list must keep its current pages.
    expect(
      resolveTopicReadSource({
        clientId: "plan-c",
        hasPlacements: true,
        plans: "plan-a",
        enabled: "1",
      }),
    ).toBe("legacy");
  });

  it("reads placements for every seeded plan when the global flag is on", () => {
    expect(
      resolveTopicReadSource({
        clientId: "plan-c",
        hasPlacements: true,
        enabled: "true",
      }),
    ).toBe("placements");
  });

  it("stays on legacy when nothing is switched on", () => {
    expect(
      resolveTopicReadSource({ clientId: "plan-a", hasPlacements: true }),
    ).toBe("legacy");
  });

  it("ignores a flag value that is not a yes", () => {
    expect(
      resolveTopicReadSource({
        clientId: "plan-a",
        hasPlacements: true,
        enabled: "0",
      }),
    ).toBe("legacy");
  });
});
