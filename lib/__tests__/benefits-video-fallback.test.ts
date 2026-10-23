import { describe, expect, it } from "vitest";

import {
  VIDEO_FALLBACK_IMAGES,
  resolveCategoryVideoFallbackImage,
  resolveJourneyImage,
  resolveVideoFallbackImageUrl,
} from "@/lib/benefits-video-fallback";

/**
 * The journey section's no-video image. Four surfaces read this module (live hubs,
 * Step 2 preview, the editor's Default Image card and its gallery), so the rules
 * are pinned here rather than re-derived in each.
 */
describe("resolveCategoryVideoFallbackImage", () => {
  it("maps each hub to its own stock image", () => {
    expect(resolveCategoryVideoFallbackImage("Retirement")).toBe(
      VIDEO_FALLBACK_IMAGES.Retirement,
    );
    expect(resolveCategoryVideoFallbackImage("Group Health")).toBe(
      VIDEO_FALLBACK_IMAGES["Group Health"],
    );
    expect(resolveCategoryVideoFallbackImage("Group Life")).toBe(
      VIDEO_FALLBACK_IMAGES["Group Life"],
    );
    expect(resolveCategoryVideoFallbackImage("Company / Plan Sponsor")).toBe(
      VIDEO_FALLBACK_IMAGES["Company / Plan Sponsor"],
    );
  });

  it("defaults an unknown or missing category to Retirement's", () => {
    expect(resolveCategoryVideoFallbackImage("Pet Insurance")).toBe(
      VIDEO_FALLBACK_IMAGES.Retirement,
    );
    expect(resolveCategoryVideoFallbackImage(undefined)).toBe(
      VIDEO_FALLBACK_IMAGES.Retirement,
    );
  });
});

describe("resolveVideoFallbackImageUrl", () => {
  it("passes data URLs, absolute URLs and app paths through", () => {
    expect(resolveVideoFallbackImageUrl("data:image/png;base64,AAA")).toBe(
      "data:image/png;base64,AAA",
    );
    expect(resolveVideoFallbackImageUrl("https://cdn.test/a.jpg")).toBe(
      "https://cdn.test/a.jpg",
    );
    expect(resolveVideoFallbackImageUrl("/gallery/a.jpg")).toBe(
      "/gallery/a.jpg",
    );
  });

  it("routes a stored R2 key through the image proxy", () => {
    expect(resolveVideoFallbackImageUrl("benefits/plan-1/fallback.png")).toBe(
      "/api/r2/object?key=benefits%2Fplan-1%2Ffallback.png",
    );
  });

  it("returns an empty string for an unset value", () => {
    expect(resolveVideoFallbackImageUrl(undefined)).toBe("");
    expect(resolveVideoFallbackImageUrl(null)).toBe("");
    expect(resolveVideoFallbackImageUrl("   ")).toBe("");
  });
});

describe("resolveJourneyImage", () => {
  it("prefers the plan's own image", () => {
    expect(resolveJourneyImage("https://cdn.test/mine.jpg", "Group Life")).toBe(
      "https://cdn.test/mine.jpg",
    );
  });

  it("uses the category's stock image when the plan has none", () => {
    expect(resolveJourneyImage(null, "Group Life")).toBe(
      VIDEO_FALLBACK_IMAGES["Group Life"],
    );
  });
});
