import { describe, expect, it } from "vitest";

import {
  parseFooterBackgroundPreference,
  PORTAL_DEFAULT_BRAND_COLOR,
  PORTAL_DEFAULT_SECONDARY_COLOR,
  resolveFooterBackgroundColor,
  resolvePortalFooterColor,
} from "../portal-footer-color";

/**
 * The portal footer colour is plan-wide: the Landing page, the four Benefit Hubs,
 * My Benefits Team and News & Events all paint it. Each surface used to carry its
 * own copy of the resolution rule, so they could disagree — these tests pin the one
 * rule they now share.
 */

const BRAND = "#1F3A60";
const SECONDARY = "#6B7280";

describe("parseFooterBackgroundPreference", () => {
  it("reads the preference out of an envelope object", () => {
    expect(
      parseFooterBackgroundPreference({
        byCategory: {},
        footerBackground: { mode: "custom", customColor: "#abcdef" },
      }),
    ).toEqual({ mode: "custom", customColor: "#abcdef" });
  });

  it("reads the preference out of a JSON-stringified envelope", () => {
    expect(
      parseFooterBackgroundPreference(
        JSON.stringify({ footerBackground: { mode: "secondary" } }),
      ),
    ).toEqual({ mode: "secondary" });
  });

  it("returns null for legacy plain-text disclaimers", () => {
    expect(parseFooterBackgroundPreference("Just words")).toBeNull();
  });

  it("returns null for an unparseable JSON string", () => {
    expect(parseFooterBackgroundPreference("{not json")).toBeNull();
  });

  it("returns null when the envelope has no preference", () => {
    expect(parseFooterBackgroundPreference({ byCategory: {} })).toBeNull();
    expect(parseFooterBackgroundPreference(null)).toBeNull();
    expect(parseFooterBackgroundPreference(undefined)).toBeNull();
  });

  it("returns null for arrays", () => {
    expect(parseFooterBackgroundPreference([{ text: "row" }])).toBeNull();
  });
});

describe("resolveFooterBackgroundColor", () => {
  it("uses the brand colour for primary and for a missing preference", () => {
    expect(resolveFooterBackgroundColor(null, BRAND, SECONDARY)).toBe(BRAND);
    expect(
      resolveFooterBackgroundColor({ mode: "primary" }, BRAND, SECONDARY),
    ).toBe(BRAND);
  });

  it("uses the secondary colour for the secondary mode", () => {
    expect(
      resolveFooterBackgroundColor({ mode: "secondary" }, BRAND, SECONDARY),
    ).toBe(SECONDARY);
  });

  it("uses the saved custom colour", () => {
    expect(
      resolveFooterBackgroundColor(
        { mode: "custom", customColor: "  #abcdef " },
        BRAND,
        SECONDARY,
      ),
    ).toBe("#abcdef");
  });

  it("falls back to the brand colour when a custom colour is blank", () => {
    expect(
      resolveFooterBackgroundColor(
        { mode: "custom", customColor: "   " },
        BRAND,
        SECONDARY,
      ),
    ).toBe(BRAND);
  });

  it("falls back to the portal defaults when colours are missing", () => {
    expect(resolveFooterBackgroundColor(null)).toBe(PORTAL_DEFAULT_BRAND_COLOR);
    expect(resolveFooterBackgroundColor({ mode: "secondary" })).toBe(
      PORTAL_DEFAULT_SECONDARY_COLOR,
    );
  });
});

describe("resolvePortalFooterColor", () => {
  it("resolves straight from a stored disclaimers envelope", () => {
    expect(
      resolvePortalFooterColor(
        {
          footerBackground: { mode: "custom", customColor: "#123456" },
        },
        BRAND,
        SECONDARY,
      ),
    ).toBe("#123456");
  });

  it("resolves from a JSON string envelope", () => {
    expect(
      resolvePortalFooterColor(
        JSON.stringify({ footerBackground: { mode: "secondary" } }),
        BRAND,
        SECONDARY,
      ),
    ).toBe(SECONDARY);
  });

  it("falls back to the brand colour for a plan with no preference", () => {
    expect(resolvePortalFooterColor("Plain text", BRAND, SECONDARY)).toBe(BRAND);
    expect(resolvePortalFooterColor(undefined, BRAND, SECONDARY)).toBe(BRAND);
  });
});
