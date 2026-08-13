/**
 * Color utility library for brand color extraction, comparison, and validation.
 *
 * Uses chroma-js for:
 *   - Lab color space conversions & deltaE distance (perceptually uniform comparison)
 *   - WCAG contrast ratio checks (4.5:1 minimum)
 *   - Corporate preset snapping
 */

import _chroma from "chroma-js";

/**
 * chroma-js is a dual CJS/ESM package. In Next.js production builds, webpack may
 * resolve the CJS bundle and wrap it in a { default } namespace object, causing
 * `import chroma from "chroma-js"` to receive `{ default: fn }` instead of `fn`.
 *
 * This guard unwraps the default export regardless of how the bundler resolves it,
 * ensuring chroma is always the callable function.
 */
const chroma: typeof _chroma =
  typeof _chroma === "function" ? _chroma : (_chroma as any).default ?? _chroma;

// ── Corporate Preset Colors (8-color safety palette) ──────────────────────────
// These are "safe" brand colors commonly used in corporate settings. Extracted
// colors are snapped to the nearest preset as a safety measure.

export const CORPORATE_PRESETS = [
  "#1F3A60", // Deep Navy
  "#0F6D66", // Teal
  "#2C5F2D", // Forest Green
  "#3A6EA5", // Steel Blue
  "#6B7280", // Slate Gray
  "#D71E28", // Crimson Red
  "#E5A100", // Amber Gold
  "#4A2E7A", // Deep Violet
] as const;

export type CorporatePreset = (typeof CORPORATE_PRESETS)[number];

// ── WCAG Constants ───────────────────────────────────────────────────────────

export const WCAG_AA_NORMAL = 4.5;
export const WCAG_AA_LARGE = 3.0;
export const WCAG_AAA_NORMAL = 7.0;

// ── Types ────────────────────────────────────────────────────────────────────

export interface LabColor {
  L: number; // 0-100
  a: number; // -128 to +128
  b: number; // -128 to +128
}

export interface ColorSafetyResult {
  original: string;
  snapped: string;
  presetName: string;
  wcagWhiteContrast: number;
  wcagBlackContrast: number;
  passesWCAG: boolean;
  /** If the color failed WCAG, this is a darkened version that passes */
  adjustedColor: string | null;
}

export interface ColorComparisonResult {
  color1: string;
  color2: string;
  deltaE: number;
  /** True if the colors are perceptually close (deltaE < threshold) */
  isClose: boolean;
  threshold: number;
}

// ── RGB ↔ Lab Conversion ────────────────────────────────────────────────────

/**
 * Convert a hex color string to Lab color space.
 * Uses chroma-js for D65 reference white.
 * Returns {L:0, a:0, b:0} for invalid inputs.
 */
export function hexToLab(hex: string): LabColor {
  const c = safeChroma(hex);
  if (!c) return { L: 0, a: 0, b: 0 };
  const [L, a, b] = c.lab();
  return { L, a, b };
}

/**
 * Convert a Lab color back to hex.
 */
export function labToHex(lab: LabColor): string {
  return chroma.lab(lab.L, lab.a, lab.b).hex().toUpperCase();
}

// ── DeltaE Distance ──────────────────────────────────────────────────────────

/**
 * Calculate the CIE76 deltaE distance between two hex colors.
 * Uses Lab color space for perceptually uniform comparison.
 * Returns Infinity for invalid inputs.
 *
 * Threshold guide:
 *   < 1.0 — imperceptible difference
 *   < 2.3 — very close (most people can't tell)
 *   < 5.0 — close (acceptable match for brand colors)
 *   < 10  — noticeable but still similar
 *   >= 10 — clearly different colors
 */
export function deltaE(hex1: string, hex2: string): number {
  const c1 = safeChroma(hex1);
  const c2 = safeChroma(hex2);
  if (!c1 || !c2) return Infinity;
  return chroma.deltaE(c1, c2);
}

/**
 * Compare two colors and return a detailed comparison result.
 *
 * @param hex1 - First hex color
 * @param hex2 - Second hex color
 * @param threshold - deltaE threshold for "close" (default: 5.0)
 */
export function compareColors(
  hex1: string,
  hex2: string,
  threshold: number = 5.0,
): ColorComparisonResult {
  const dE = deltaE(hex1, hex2);
  return {
    color1: hex1.toUpperCase(),
    color2: hex2.toUpperCase(),
    deltaE: Math.round(dE * 100) / 100,
    isClose: dE <= threshold,
    threshold,
  };
}

// ── Safe chroma wrapper ──────────────────────────────────────────────────────

/**
 * Safely parse a hex string with chroma-js, returning null on invalid input.
 * Prevents "unknown format: #" crashes from partial hex like "#" or "#12".
 */
function safeChroma(value: string): chroma.Color | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "#") return null;
  // Must look like a hex: # followed by 3, 4, 6, or 8 hex digits
  if (!/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) return null;
  try {
    return chroma(trimmed);
  } catch {
    return null;
  }
}

// ── WCAG Contrast Ratio ─────────────────────────────────────────────────────

/**
 * Calculate the WCAG 2.1 contrast ratio between two hex colors.
 * Returns a value between 1.0 and 21.0, or 1.0 for invalid inputs.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const c1 = safeChroma(hex1);
  const c2 = safeChroma(hex2);
  if (!c1 || !c2) return 1;
  return chroma.contrast(c1, c2);
}

/**
 * Check if a foreground color meets WCAG AA contrast against a background.
 * Returns false for invalid inputs.
 *
 * @param foreground - Foreground hex color
 * @param background - Background hex color (default: "#FFFFFF")
 * @param minRatio - Minimum ratio required (default: 4.5 for AA normal text)
 */
export function meetsWCAG(
  foreground: string,
  background: string = "#FFFFFF",
  minRatio: number = WCAG_AA_NORMAL,
): boolean {
  return contrastRatio(foreground, background) >= minRatio;
}

/**
 * Get WCAG contrast ratios against both white and black.
 * Returns safe defaults for invalid inputs.
 */
export function getContrastScores(hex: string): {
  againstWhite: number;
  againstBlack: number;
  passesWhite: boolean;
  passesBlack: boolean;
} {
  if (!safeChroma(hex)) {
    return {
      againstWhite: 1,
      againstBlack: 1,
      passesWhite: false,
      passesBlack: false,
    };
  }
  const againstWhite = contrastRatio(hex, "#FFFFFF");
  const againstBlack = contrastRatio(hex, "#000000");
  return {
    againstWhite: Math.round(againstWhite * 100) / 100,
    againstBlack: Math.round(againstBlack * 100) / 100,
    passesWhite: againstWhite >= WCAG_AA_NORMAL,
    passesBlack: againstBlack >= WCAG_AA_NORMAL,
  };
}

// ── Color Adjustment ─────────────────────────────────────────────────────────

/**
 * Darken a hex color by a given amount until it passes WCAG AA against white,
 * or lighten it until it passes against black.
 *
 * Strategy: tries to darken (for white text) first. If the color gets too dark
 * (below L=15), switches to lightening (for black text on dark backgrounds).
 *
 * @param hex - Starting hex color
 * @param step - Amount to darken/lighten per iteration (in chroma darken units, 0-1)
 * @returns The adjusted hex color that passes WCAG
 */
export function adjustForWCAG(hex: string, step: number = 0.05): string {
  const c = safeChroma(hex);
  if (!c) return hex;

  const scores = getContrastScores(hex);

  // Already passes both → no adjustment needed
  if (scores.passesWhite && scores.passesBlack) return hex;

  // Try darkening (for white text usage)
  let adjusted = c;
  let iterations = 0;
  const MAX_ITERATIONS = 50;

  if (!scores.passesWhite) {
    while (iterations < MAX_ITERATIONS) {
      adjusted = adjusted.darken(step);
      const ratio = chroma.contrast(adjusted, "#FFFFFF");
      if (ratio >= WCAG_AA_NORMAL) {
        return adjusted.hex().toUpperCase();
      }
      iterations++;
    }
  }

  // If darkening didn't help or color passes white but not black,
  // try lightening (for black text on dark-ish backgrounds)
  if (!scores.passesBlack) {
    adjusted = c;
    iterations = 0;
    while (iterations < MAX_ITERATIONS) {
      adjusted = adjusted.brighten(step);
      const ratio = chroma.contrast(adjusted, "#000000");
      if (ratio >= WCAG_AA_NORMAL) {
        return adjusted.hex().toUpperCase();
      }
      iterations++;
    }
  }

  // Fallback: return original (should rarely happen)
  return hex;
}

// ── Corporate Preset Snapping ────────────────────────────────────────────────

/**
 * Snap a hex color to the nearest corporate preset using deltaE distance.
 *
 * @param hex - The hex color to snap
 * @returns The nearest preset hex color
 */
export function snapToNearestPreset(hex: string): string {
  let bestPreset: string = CORPORATE_PRESETS[0];
  let bestDistance = Infinity;

  for (const preset of CORPORATE_PRESETS) {
    // Exclude Slate Gray (#6B7280) from snapping: muted "slate" brand colors
    // (slate plum, slate green, etc.) are perceptually closest to gray and
    // would otherwise all collapse to the same gray preset, erasing their
    // actual hue. Gray is not a color we want to recommend as a brand
    // primary/secondary.
    if (preset === "#6B7280") continue;
    const d = deltaE(hex, preset);
    if (d < bestDistance) {
      bestDistance = d;
      bestPreset = preset;
    }
  }

  return bestPreset;
}

/**
 * Get the name of a corporate preset (for UI display).
 */
export function getPresetName(hex: string): string {
  const names: Record<string, string> = {
    "#1F3A60": "Deep Navy",
    "#0F6D66": "Teal",
    "#2C5F2D": "Forest Green",
    "#3A6EA5": "Steel Blue",
    "#6B7280": "Slate Gray",
    "#D71E28": "Crimson Red",
    "#E5A100": "Amber Gold",
    "#4A2E7A": "Deep Violet",
  };
  return names[hex.toUpperCase()] || "Custom";
}

// ── Full Safety Pass ─────────────────────────────────────────────────────────

/**
 * Run a complete safety pass on a candidate brand color:
 * 1. Snap to nearest corporate preset
 * 2. Check WCAG contrast against white and black
 * 3. If it fails, compute an adjusted version that passes
 *
 * @param hex - Raw candidate hex color
 * @returns Safety result with snapped color, WCAG scores, and adjusted version if needed
 */
export function safetyPass(hex: string): ColorSafetyResult {
  const snapped = snapToNearestPreset(hex);
  const scores = getContrastScores(snapped);
  const passes = scores.passesWhite || scores.passesBlack;

  let adjustedColor: string | null = null;
  if (!passes) {
    adjustedColor = adjustForWCAG(snapped);
  }

  return {
    original: hex.toUpperCase(),
    snapped,
    presetName: getPresetName(snapped),
    wcagWhiteContrast: scores.againstWhite,
    wcagBlackContrast: scores.againstBlack,
    passesWCAG: passes,
    adjustedColor,
  };
}

// ── Hex Validation ───────────────────────────────────────────────────────────

/**
 * Validate a hex color string.
 */
export function isValidHex(value: string): boolean {
  return safeChroma(value) !== null;
}

/**
 * Normalize a hex color to uppercase 6-digit format.
 * Returns the original string if invalid.
 */
export function normalizeHex(value: string): string {
  const c = safeChroma(value);
  if (!c) return value;
  try {
    return c.hex().toUpperCase();
  } catch {
    return value;
  }
}

// ── Color Brightness ─────────────────────────────────────────────────────────

/**
 * Calculate relative luminance (0-1) for a hex color.
 * Used to determine if text on this background should be white or black.
 * Returns 0 for invalid inputs.
 */
export function luminance(hex: string): number {
  const c = safeChroma(hex);
  if (!c) return 0;
  return c.luminance();
}

/**
 * Determine the best text color (black or white) for a given background.
 * Defaults to "#000000" for invalid inputs.
 */
export function bestTextColor(background: string): "#FFFFFF" | "#000000" {
  return luminance(background) > 0.5 ? "#000000" : "#FFFFFF";
}
