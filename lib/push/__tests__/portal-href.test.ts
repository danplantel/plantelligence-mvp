import { describe, expect, it } from "vitest";

import {
  planIdFromNotificationHref,
  portalHrefForNotification,
  portalSegmentForDashboardSegment,
  threadIdFromNotificationHref,
} from "@/lib/push/portal-href";

/**
 * Dashboard link → portal link.
 *
 * This is what stops a participant tapping a push on their phone and landing in the advisor's
 * dashboard. The two surfaces use DIFFERENT words for the same benefit (`group-health` vs
 * `health-insurance`), so the mapping has to be explicit rather than a string pass-through.
 */
describe("portalSegmentForDashboardSegment", () => {
  it("crosses the two vocabularies", () => {
    expect(portalSegmentForDashboardSegment("group-health")).toBe(
      "health-insurance",
    );
    expect(portalSegmentForDashboardSegment("group-life")).toBe(
      "life-insurance",
    );
    expect(portalSegmentForDashboardSegment("retirement")).toBe("retirement");
  });

  it("sends the Custom hub to the legacy portal segment", () => {
    // `company-plan-sponsor` is the dashboard's slug; the portal addresses "Other" at
    // `wellness-programs`, which needs no extra query for the advisor's chosen hub name.
    expect(portalSegmentForDashboardSegment("company-plan-sponsor")).toBe(
      "wellness-programs",
    );
  });

  it("returns null for a segment it does not know", () => {
    expect(portalSegmentForDashboardSegment("documents")).toBeNull();
  });
});

describe("portalHrefForNotification", () => {
  it("keeps the thread deep link when translating a benefit comment", () => {
    expect(
      portalHrefForNotification({
        href: "/edit-benefit/plan_1/group-health?comment=thread_9",
        planSlug: "acme",
      }),
    ).toBe("/acme/health-insurance?comment=thread_9");
  });

  it("sends a plan-level thread to the portal landing page", () => {
    expect(
      portalHrefForNotification({
        href: "/edit-client/plan_1?comment=thread_9",
        planSlug: "acme",
      }),
    ).toBe("/acme?comment=thread_9");
  });

  it("falls back to the portal root for a benefit it cannot translate", () => {
    expect(
      portalHrefForNotification({
        href: "/edit-benefit/plan_1/unknown-category?comment=t1",
        planSlug: "acme",
      }),
    ).toBe("/acme");
  });

  it("returns the portal root for a notification with no link", () => {
    expect(portalHrefForNotification({ href: null, planSlug: "acme" })).toBe(
      "/acme",
    );
  });

  it("refuses to invent a destination for a direct message", () => {
    // Messages are dashboard chrome; the portal has no rail for them. Null lets the caller fall
    // back to the portal root instead of opening a page that does not exist.
    expect(
      portalHrefForNotification({
        href: "/?messages=thread_9",
        planSlug: "acme",
      }),
    ).toBeNull();
  });

  it("refuses to approximate an unrelated dashboard route", () => {
    expect(
      portalHrefForNotification({ href: "/settings?tab=members", planSlug: "acme" }),
    ).toBeNull();
  });

  it("returns null without a plan slug, because a portal URL cannot be derived", () => {
    expect(
      portalHrefForNotification({
        href: "/edit-client/plan_1?comment=t1",
        planSlug: null,
      }),
    ).toBeNull();
  });
});

describe("planIdFromNotificationHref", () => {
  it("reads the plan from a comment link", () => {
    expect(planIdFromNotificationHref("/edit-client/plan_1?comment=t1")).toBe(
      "plan_1",
    );
    expect(
      planIdFromNotificationHref("/edit-benefit/plan_2/group-life?comment=t1"),
    ).toBe("plan_2");
  });

  it("returns null when the link names no plan", () => {
    expect(planIdFromNotificationHref("/?messages=t1")).toBeNull();
    expect(planIdFromNotificationHref(null)).toBeNull();
  });
});

describe("threadIdFromNotificationHref", () => {
  it("reads the conversation from either deep link", () => {
    expect(threadIdFromNotificationHref("/edit-client/p1?comment=t1")).toBe("t1");
    expect(threadIdFromNotificationHref("/?messages=t2")).toBe("t2");
  });

  it("returns null when there is no conversation", () => {
    expect(threadIdFromNotificationHref("/settings")).toBeNull();
    expect(threadIdFromNotificationHref(null)).toBeNull();
  });
});
