import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCHEDULE_CTA_LABEL,
  normalizePortalHeaderCta,
  portalHeaderCtaLabel,
  resolvePortalHeaderCtaHref,
} from "../portal-header-cta";

/**
 * The plan-level Portal Header button (Section 1 of the editing panel).
 *
 * The important property is the fallback: an absent or unrecognized value must
 * resolve to `login`, because that is what every plan rendered before the setting
 * existed — no backfill, no visual change on deploy.
 */

describe("normalizePortalHeaderCta", () => {
  it("falls back to Login when nothing is stored", () => {
    expect(normalizePortalHeaderCta(undefined)).toEqual({ mode: "login" });
    expect(normalizePortalHeaderCta(null)).toEqual({ mode: "login" });
    expect(normalizePortalHeaderCta("")).toEqual({ mode: "login" });
    expect(normalizePortalHeaderCta("schedule")).toEqual({ mode: "login" });
  });

  it("falls back to Login for a mode it does not know", () => {
    expect(normalizePortalHeaderCta({ mode: "telepathy" })).toEqual({
      mode: "login",
    });
  });

  it("trims the booking details", () => {
    expect(
      normalizePortalHeaderCta({
        mode: "schedule",
        url: "  https://cal.com/team  ",
        label: "  Book a review  ",
      }),
    ).toEqual({
      mode: "schedule",
      url: "https://cal.com/team",
      label: "Book a review",
    });
  });

  it("drops blank details instead of storing empty strings", () => {
    expect(
      normalizePortalHeaderCta({ mode: "schedule", url: "   ", label: "" }),
    ).toEqual({ mode: "schedule" });
  });

  it("keeps the booking details when the mode is not schedule", () => {
    // So switching back to Schedule finds the advisor's link where they left it.
    expect(
      normalizePortalHeaderCta({ mode: "none", url: "https://cal.com/team" }),
    ).toEqual({ mode: "none", url: "https://cal.com/team" });
  });

  it("accepts the two non-default modes as-is", () => {
    expect(normalizePortalHeaderCta({ mode: "schedule" })).toEqual({
      mode: "schedule",
    });
    expect(normalizePortalHeaderCta({ mode: "none" })).toEqual({ mode: "none" });
  });
});

describe("portalHeaderCtaLabel", () => {
  it("names the Login button", () => {
    expect(portalHeaderCtaLabel({ mode: "login" })).toBe("Login");
  });

  it("returns nothing for None", () => {
    expect(portalHeaderCtaLabel({ mode: "none" })).toBe("");
  });

  it("defaults the booking label and honours an override", () => {
    expect(portalHeaderCtaLabel({ mode: "schedule" })).toBe(
      DEFAULT_SCHEDULE_CTA_LABEL,
    );
    expect(
      portalHeaderCtaLabel({ mode: "schedule", label: "Book a review" }),
    ).toBe("Book a review");
    // Whitespace is not a label.
    expect(portalHeaderCtaLabel({ mode: "schedule", label: "   " })).toBe(
      DEFAULT_SCHEDULE_CTA_LABEL,
    );
  });
});

describe("resolvePortalHeaderCtaHref", () => {
  it("returns nothing for a missing link", () => {
    expect(resolvePortalHeaderCtaHref("")).toEqual({ href: "", external: false });
    expect(resolvePortalHeaderCtaHref(undefined)).toEqual({
      href: "",
      external: false,
    });
    expect(resolvePortalHeaderCtaHref("   ")).toEqual({
      href: "",
      external: false,
    });
  });

  it("treats a bare domain as https", () => {
    expect(resolvePortalHeaderCtaHref("calendly.com/team")).toEqual({
      href: "https://calendly.com/team",
      external: true,
    });
  });

  it("honours an explicit scheme", () => {
    expect(resolvePortalHeaderCtaHref("http://intranet/book")).toEqual({
      href: "http://intranet/book",
      external: true,
    });
  });

  it("keeps portal paths, anchors, mail and tel in the tab", () => {
    expect(resolvePortalHeaderCtaHref("/plan-1/my-benefits-team")).toEqual({
      href: "/plan-1/my-benefits-team",
      external: false,
    });
    expect(resolvePortalHeaderCtaHref("#have-questions")).toEqual({
      href: "#have-questions",
      external: false,
    });
    expect(resolvePortalHeaderCtaHref("mailto:benefits@example.com")).toEqual({
      href: "mailto:benefits@example.com",
      external: false,
    });
    expect(resolvePortalHeaderCtaHref("tel:+15551234567")).toEqual({
      href: "tel:+15551234567",
      external: false,
    });
  });
});
