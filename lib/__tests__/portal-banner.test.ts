import { describe, expect, it } from "vitest";

import { getPortalCountdown, normalizePortalCtaUrl } from "../portal-banner";

/**
 * The portal banner's two pure rules.
 *
 * `normalizePortalCtaUrl` exists because the CTA is opened in a new tab: a bare
 * host needs a scheme, but a link that already has one — including `mailto:`
 * and `tel:` — must survive untouched. The inline version prefixed `https://`
 * to anything that was not `http(s)`, which turned `mailto:advice@acme.com`
 * into `https://mailto:advice@acme.com`.
 *
 * `getPortalCountdown` is the arithmetic behind the `d hh:mm:ss` display and
 * the **Expired** state.
 */

describe("normalizePortalCtaUrl", () => {
  it("leaves an absolute http(s) URL alone", () => {
    expect(normalizePortalCtaUrl("https://acme.test/enroll")).toBe(
      "https://acme.test/enroll",
    );
    expect(normalizePortalCtaUrl("http://acme.test/enroll")).toBe(
      "http://acme.test/enroll",
    );
  });

  it("assumes https for a bare host", () => {
    expect(normalizePortalCtaUrl("acme.test/enroll")).toBe(
      "https://acme.test/enroll",
    );
    expect(normalizePortalCtaUrl("  acme.test  ")).toBe("https://acme.test");
  });

  it("keeps mailto: and tel: intact", () => {
    expect(normalizePortalCtaUrl("mailto:advice@acme.com")).toBe(
      "mailto:advice@acme.com",
    );
    expect(normalizePortalCtaUrl("tel:+13055551122")).toBe("tel:+13055551122");
  });

  it("keeps same-site paths and anchors", () => {
    expect(normalizePortalCtaUrl("/contact")).toBe("/contact");
    expect(normalizePortalCtaUrl("#questions")).toBe("#questions");
  });

  it("returns undefined for nothing to link to", () => {
    expect(normalizePortalCtaUrl("")).toBeUndefined();
    expect(normalizePortalCtaUrl("   ")).toBeUndefined();
    expect(normalizePortalCtaUrl(null)).toBeUndefined();
    expect(normalizePortalCtaUrl(undefined)).toBeUndefined();
  });
});

describe("getPortalCountdown", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");

  it("returns null for a missing or unparseable target", () => {
    expect(getPortalCountdown(null, now)).toBeNull();
    expect(getPortalCountdown(undefined, now)).toBeNull();
    expect(getPortalCountdown("", now)).toBeNull();
    expect(getPortalCountdown("not-a-date", now)).toBeNull();
  });

  it("splits the remaining time into days, hours, minutes and seconds", () => {
    // 2 days, 3 hours, 4 minutes, 5 seconds
    const target = now + ((2 * 24 + 3) * 3_600 + 4 * 60 + 5) * 1_000;

    expect(getPortalCountdown(new Date(target).toISOString(), now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      expired: false,
    });
  });

  it("rolls the hours over inside a day", () => {
    const target = now + (23 * 3_600 + 59 * 60 + 59) * 1_000;

    expect(getPortalCountdown(target, now)).toMatchObject({
      days: 0,
      hours: 23,
      minutes: 59,
      seconds: 59,
      expired: false,
    });
  });

  it("accepts a Date, a number and an ISO string", () => {
    const target = now + 60_000;

    expect(getPortalCountdown(new Date(target), now)?.minutes).toBe(1);
    expect(getPortalCountdown(target, now)?.minutes).toBe(1);
    expect(
      getPortalCountdown(new Date(target).toISOString(), now)?.minutes,
    ).toBe(1);
  });

  it("marks the target expired once it is reached", () => {
    expect(getPortalCountdown(now, now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: true,
    });
    expect(getPortalCountdown(now - 1, now)?.expired).toBe(true);
  });
});
