import { describe, expect, it } from "vitest";

import {
  DEFAULT_TYPOGRAPHY_THEME,
  TYPOGRAPHY_THEMES,
  TYPOGRAPHY_THEME_LIST,
  applyTypographyToElement,
  getPortalShapeCssVars,
  getPortalThemeCssVars,
  getTypographyCssVars,
  isTypographyThemeId,
  normalizeTypographyThemeId,
  portalRadiusValue,
  resolveTypographyTheme,
} from "../typography-themes";

/**
 * The portal layout spreads `getTypographyCssVars(theme)` onto its root, and
 * `--font-ui` on the same element, so this module decides the portal's fonts
 * for every plan.
 *
 * The contract is small but total: three custom properties, always present,
 * always strings, and an unknown or missing id resolving to Classic so a plan
 * saved before themes existed still renders (no backfill needed).
 */

const CSS_VAR_KEYS = ["--font-headline", "--font-body", "--font-ui"] as const;

describe("getTypographyCssVars", () => {
  it("always emits the three portal font variables", () => {
    const vars = getTypographyCssVars("classic");

    expect(Object.keys(vars).sort()).toEqual([...CSS_VAR_KEYS].sort());
    for (const key of CSS_VAR_KEYS) {
      expect(typeof vars[key]).toBe("string");
      expect(vars[key].trim().length).toBeGreaterThan(0);
    }
  });

  it("resolves a known theme's fonts", () => {
    const vars = getTypographyCssVars("classic");
    const theme = TYPOGRAPHY_THEMES.classic;

    expect(vars).toEqual({
      "--font-headline": theme.headline,
      "--font-body": theme.body,
      "--font-ui": theme.ui,
    });
  });

  it("falls back to Classic for an unknown, blank or missing id", () => {
    const classic = getTypographyCssVars("classic");

    expect(getTypographyCssVars("no-such-theme")).toEqual(classic);
    expect(getTypographyCssVars("")).toEqual(classic);
    expect(getTypographyCssVars(null)).toEqual(classic);
    expect(getTypographyCssVars(undefined)).toEqual(classic);
  });
});

describe("theme registry", () => {
  it("lists every registered theme exactly once", () => {
    const ids = TYPOGRAPHY_THEME_LIST.map((theme) => theme.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(Object.keys(TYPOGRAPHY_THEMES).sort());
  });

  it("treats only registered ids as valid", () => {
    expect(isTypographyThemeId("classic")).toBe(true);
    expect(isTypographyThemeId("no-such-theme")).toBe(false);
    expect(isTypographyThemeId(null)).toBe(false);
    expect(isTypographyThemeId(42)).toBe(false);
  });

  it("normalizes an unknown id to the default", () => {
    expect(normalizeTypographyThemeId("no-such-theme")).toBe(
      DEFAULT_TYPOGRAPHY_THEME,
    );
    expect(normalizeTypographyThemeId(null)).toBe(DEFAULT_TYPOGRAPHY_THEME);
    expect(normalizeTypographyThemeId("classic")).toBe("classic");
  });

  it("resolves the default theme object for an unknown id", () => {
    expect(resolveTypographyTheme("no-such-theme")).toBe(
      TYPOGRAPHY_THEMES[DEFAULT_TYPOGRAPHY_THEME],
    );
  });
});

/**
 * Corner treatment is bundled with each theme (Classic + Contemporary sharp,
 * Modern + Editorial rounded) and published as `--portal-radius`.
 */
describe("theme shape", () => {
  it("maps each theme to sharp or rounded corners", () => {
    expect(TYPOGRAPHY_THEMES.classic).toMatchObject({
      shape: "sharp",
      radius: "0px",
    });
    expect(TYPOGRAPHY_THEMES.modern.shape).toBe("round");
    expect(TYPOGRAPHY_THEMES.editorial.shape).toBe("round");
    expect(TYPOGRAPHY_THEMES.contemporary).toMatchObject({
      shape: "sharp",
      radius: "0px",
    });
  });

  it("gives every rounded theme a positive radius and every sharp one 0px", () => {
    for (const theme of TYPOGRAPHY_THEME_LIST) {
      if (theme.shape === "round") {
        expect(parseFloat(theme.radius)).toBeGreaterThan(0);
      } else {
        expect(theme.radius).toBe("0px");
      }
    }
  });

  it("publishes --portal-radius for the resolved theme", () => {
    expect(getPortalShapeCssVars("classic")).toEqual({
      "--portal-radius": "0px",
    });
    expect(getPortalShapeCssVars("modern")).toEqual({
      "--portal-radius": TYPOGRAPHY_THEMES.modern.radius,
    });
    // Unknown/empty resolves to Classic, like the fonts do.
    expect(getPortalShapeCssVars("no-such-theme")).toEqual(
      getPortalShapeCssVars("classic"),
    );
    expect(getPortalShapeCssVars(undefined)).toEqual(
      getPortalShapeCssVars(DEFAULT_TYPOGRAPHY_THEME),
    );
  });

  it("combines fonts and shape for the portal root", () => {
    expect(getPortalThemeCssVars("editorial")).toEqual({
      ...getTypographyCssVars("editorial"),
      "--portal-radius": TYPOGRAPHY_THEMES.editorial.radius,
    });
  });

  it("never puts the radius on <html> via applyTypographyToElement", () => {
    // The editors apply fonts to documentElement so every preview (including the
    // phone iframe) inherits them. A global radius there would reshape the
    // DASHBOARD, so the shape deliberately travels on the preview containers only.
    const element = document.createElement("div");
    const cleanup = applyTypographyToElement(element, "classic");

    expect(element.style.getPropertyValue("--portal-radius")).toBe("");

    cleanup();
  });
});

describe("applyTypographyToElement", () => {
  it("sets the variables and restores what was there before", () => {
    const element = document.createElement("div");
    element.style.setProperty("--font-body", "Original Body");

    const cleanup = applyTypographyToElement(element, "classic");

    expect(element.style.getPropertyValue("--font-headline")).toBe(
      TYPOGRAPHY_THEMES.classic.headline,
    );
    expect(element.style.getPropertyValue("--font-body")).toBe(
      TYPOGRAPHY_THEMES.classic.body,
    );

    cleanup();

    expect(element.style.getPropertyValue("--font-body")).toBe("Original Body");
  });

  it("is a no-op without an element", () => {
    expect(() => applyTypographyToElement(null, "classic")()).not.toThrow();
  });
});

describe("portalRadiusValue", () => {
  it("reads the portal radius at the base step", () => {
    expect(portalRadiusValue()).toBe("var(--portal-radius, var(--radius))");
  });

  it("scales the base step for the larger surfaces", () => {
    expect(portalRadiusValue(2)).toBe(
      "calc(var(--portal-radius, var(--radius)) * 2)",
    );
  });

  it("keeps the app's base radius as the fallback outside the portal", () => {
    // Every non-portal surface leaves `--portal-radius` unset, so the expression
    // has to fall back to `--radius` — the same value the utilities used before
    // themes carried a shape.
    expect(portalRadiusValue(1.5)).toContain("var(--radius)");
  });

  it("reaches exactly 0px for a sharp theme", () => {
    // A multiple (not an offset) is what lets Classic/Contemporary square every
    // corner off instead of leaving a stub radius behind.
    expect(TYPOGRAPHY_THEMES.classic.radius).toBe("0px");
    expect(TYPOGRAPHY_THEMES.contemporary.radius).toBe("0px");
    expect(portalRadiusValue(3)).toBe(
      "calc(var(--portal-radius, var(--radius)) * 3)",
    );
  });
});
