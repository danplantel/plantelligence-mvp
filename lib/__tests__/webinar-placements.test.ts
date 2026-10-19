import { describe, expect, it } from "vitest";

import {
  DEFAULT_WEBINAR_PLACEMENT,
  WEBINAR_PLACEMENTS,
  hasWebinarPlacement,
  isWebinarPlacementKey,
  normalizeWebinarPlacements,
} from "@/lib/webinar-placements";

describe("webinar placement constants", () => {
  it("declares the five portal pages", () => {
    expect(WEBINAR_PLACEMENTS.map((p) => p.key)).toEqual([
      "news-events",
      "retirement",
      "health-insurance",
      "life-insurance",
      "wellness-programs",
    ]);
    expect(WEBINAR_PLACEMENTS.map((p) => p.label)).toEqual([
      "News & Events",
      "Retirement",
      "Health Insurance",
      "Life Insurance",
      "Custom",
    ]);
    expect(DEFAULT_WEBINAR_PLACEMENT).toBe("news-events");
  });
});

describe("normalizeWebinarPlacements", () => {
  it("keeps known keys in order and dedupes them", () => {
    expect(
      normalizeWebinarPlacements([
        "retirement",
        "news-events",
        "retirement",
        "life-insurance",
      ]),
    ).toEqual(["retirement", "news-events", "life-insurance"]);
  });

  it("drops unknown and non-string values", () => {
    expect(
      normalizeWebinarPlacements([
        "retirement",
        "unknown",
        42,
        null,
        "wellness-programs",
      ]),
    ).toEqual(["retirement", "wellness-programs"]);
  });

  it("falls back to News & Events for non-arrays or an empty result", () => {
    expect(normalizeWebinarPlacements(undefined)).toEqual(["news-events"]);
    expect(normalizeWebinarPlacements(null)).toEqual(["news-events"]);
    expect(normalizeWebinarPlacements("retirement")).toEqual(["news-events"]);
    expect(normalizeWebinarPlacements([])).toEqual(["news-events"]);
    expect(normalizeWebinarPlacements(["unknown"])).toEqual(["news-events"]);
    expect(normalizeWebinarPlacements([1, 2])).toEqual(["news-events"]);
  });
});

describe("hasWebinarPlacement", () => {
  it("is true when the normalized list includes the key", () => {
    expect(hasWebinarPlacement(["news-events", "retirement"], "retirement")).toBe(
      true,
    );
    expect(hasWebinarPlacement("retirement", "retirement")).toBe(false);
  });

  it("treats malformed values as the default placement", () => {
    expect(hasWebinarPlacement(undefined, "news-events")).toBe(true);
    expect(hasWebinarPlacement([], "news-events")).toBe(true);
    expect(hasWebinarPlacement(["unknown"], "retirement")).toBe(false);
  });
});

describe("isWebinarPlacementKey", () => {
  it("accepts only the declared keys", () => {
    expect(isWebinarPlacementKey("news-events")).toBe(true);
    expect(isWebinarPlacementKey("wellness-programs")).toBe(true);
    expect(isWebinarPlacementKey("retirement")).toBe(true);
    expect(isWebinarPlacementKey("benefits")).toBe(false);
    expect(isWebinarPlacementKey("")).toBe(false);
    expect(isWebinarPlacementKey(null)).toBe(false);
    expect(isWebinarPlacementKey(1)).toBe(false);
  });
});
