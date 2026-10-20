import { describe, expect, it } from "vitest";

import {
  DEFAULT_TYPOGRAPHY_THEME,
  TYPOGRAPHY_THEMES,
  TYPOGRAPHY_THEME_LIST,
  applyTypographyToElement,
  getTypographyCssVars,
  isTypographyThemeId,
  normalizeTypographyThemeId,
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
