import { describe, expect, it } from "vitest";

import {
  portalCommentsSurface,
  wantsCommentsRail,
  withCommentsRail,
} from "@/lib/comments/portal-surface";

describe("withCommentsRail", () => {
  it("adds the flag with ? when the URL has no query", () => {
    expect(withCommentsRail("https://portal.test/acme/retirement")).toBe(
      "https://portal.test/acme/retirement?comments=on",
    );
  });

  it("adds the flag with & when the URL already has a query", () => {
    expect(withCommentsRail("https://portal.test/acme?tab=docs")).toBe(
      "https://portal.test/acme?tab=docs&comments=on",
    );
  });

  it("keeps a trailing hash last", () => {
    expect(withCommentsRail("https://portal.test/acme#team")).toBe(
      "https://portal.test/acme?comments=on#team",
    );
  });

  it("is idempotent and leaves an existing flag untouched", () => {
    const once = withCommentsRail("https://portal.test/acme");
    expect(withCommentsRail(once)).toBe(once);
    expect(withCommentsRail("https://portal.test/acme?comments=off")).toBe(
      "https://portal.test/acme?comments=off",
    );
  });

  it("returns an empty URL unchanged", () => {
    expect(withCommentsRail("")).toBe("");
  });
});

describe("wantsCommentsRail", () => {
  it("accepts the exact on value with or without a leading ?", () => {
    expect(wantsCommentsRail("?comments=on")).toBe(true);
    expect(wantsCommentsRail("comments=on")).toBe(true);
    expect(wantsCommentsRail("?a=1&comments=on")).toBe(true);
  });

  it("rejects any other value or an absent flag", () => {
    expect(wantsCommentsRail("")).toBe(false);
    expect(wantsCommentsRail("?comments=1")).toBe(false);
    expect(wantsCommentsRail("?comments=anything")).toBe(false);
    expect(wantsCommentsRail("?tab=docs")).toBe(false);
  });
});

describe("portalCommentsSurface", () => {
  it("maps the plan landing page to the plan surface", () => {
    expect(
      portalCommentsSurface({ pathname: "/acme", planSlug: "acme" }),
    ).toEqual({ targetType: "plan", category: null });
  });

  it("maps each benefit segment to its real category", () => {
    expect(
      portalCommentsSurface({
        pathname: "/acme/health-insurance",
        planSlug: "acme",
      }),
    ).toEqual({ targetType: "benefit", category: "Group Health" });
  });

  it("maps a named Custom hub slug to Other", () => {
    expect(
      portalCommentsSurface({
        pathname: "/acme/mindfulness-and-me",
        planSlug: "acme",
        customHubSlug: "mindfulness-and-me",
      }),
    ).toEqual({ targetType: "benefit", category: "Other" });
  });

  it("returns null for a path that belongs to another plan or is too deep", () => {
    expect(
      portalCommentsSurface({
        pathname: "/other/retirement",
        planSlug: "acme",
      }),
    ).toBeNull();
    expect(
      portalCommentsSurface({
        pathname: "/acme/retirement/extra",
        planSlug: "acme",
      }),
    ).toBeNull();
  });

  it("returns null for an unknown segment rather than guessing", () => {
    expect(
      portalCommentsSurface({ pathname: "/acme/dental", planSlug: "acme" }),
    ).toBeNull();
  });
});
