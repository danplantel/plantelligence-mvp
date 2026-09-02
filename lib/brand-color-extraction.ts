/**
 * Brand Color Extraction Orchestrator
 *
 * Coordinates the multi-source brand color extraction flow:
 *   1. Logo extraction (via node-vibrant / canvas pixel analysis)
 *   2. Website extraction (via server-side Puppeteer API)
 *   3. Cross-check with Lab color space + deltaE
 *   4. Safety pass (corporate preset snapping + WCAG contrast check)
 *   5. AI fallback (when logo and site disagree — triggers only on divergence)
 *
 * This module runs on the CLIENT SIDE. The website extraction API call goes
 * to /api/extract-site-colors which runs Puppeteer server-side.
 */

import { extractColorsFromImage } from "./extract-colors-from-image";
import {
  compareColors,
  safetyPass,
  snapToNearestPreset,
  getPresetName,
  meetsWCAG,
  contrastRatio,
  deltaE,
  luminance,
  getContrastScores,
  WCAG_AA_NORMAL,
  type ColorSafetyResult,
  type ColorComparisonResult,
} from "./color-utils";

// ── Types ────────────────────────────────────────────────────────────────────

export type ExtractionSource = "logo" | "website" | "both-agree" | "manual" | "ai-resolved";

export type ExtractionConfidence = "high" | "medium" | "low" | "needs-review";

/** Website technology detection returned by /api/extract-site-colors. */
export interface SiteTechInfo {
  category: "cms" | "js-framework" | "static" | "blocked";
  framework: string;
  label: string;
  confidence: "high" | "medium" | "low";
  signals: string[];
}

export interface SiteColorResponse {
  success: boolean;
  data?: {
    primary: string | null;
    secondary: string | null;
    candidates: Array<{
      hex: string;
      source: "button" | "nav" | "link" | "heading" | "other";
      selector: string;
      weight: number;
      property: string;
    }>;
    confidence: number;
    weakExtraction: boolean;
    url: string;
    /** Detected website technology (category + framework), for debugging/rollout. */
    detectedType?: SiteTechInfo | null;
    /** True when the site appears to block automated access. */
    blocked?: boolean;
  };
  error?: string;
  details?: string;
}

export interface ExtractionStep {
  source: ExtractionSource;
  primary: string;
  secondary: string;
  confidence: ExtractionConfidence;
  needsManualReview: boolean;
  logoColor?: string;
  siteColor?: string;
  deltaE?: number;
  warnings: string[];
}

export interface SafeColorResult {
  /** Final primary brand color (safety-passed) */
  primary: string;
  /** Final secondary brand color (safety-passed) */
  secondary: string;
  /** Detailed extraction step info for UI display */
  extraction: ExtractionStep;
  /** Safety results for both colors */
  safety: {
    primary: ColorSafetyResult;
    secondary: ColorSafetyResult;
  };
  /** Comparison between logo and site primary colors */
  comparison: ColorComparisonResult | null;
  /** The website URL used for extraction (if any) */
  siteUrl?: string;
}

// ── DeltaE Thresholds ────────────────────────────────────────────────────────

/** Colors within this deltaE are considered "close" (auto-fill with high confidence) */
const CLOSE_THRESHOLD = 5.0;

/** Colors between CLOSE and DIVERGE thresholds are flagged for manual review */
const DIVERGE_THRESHOLD = 12.0;

/** Maximum source candidates to consider for secondary color */
const MAX_CANDIDATES = 5;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract brand colors from both logo and website, cross-check, and safety-pass.
 *
 * This is the main entry point. It:
 * 1. Extracts colors from the logo (if provided)
 * 2. Extracts colors from the website (if URL provided)
 * 3. Cross-checks logo vs site using deltaE
 * 4. Applies safety pass (corporate preset snap + WCAG)
 * 5. Returns the final recommended colors with metadata
 *
 * @param logoDataUrl - Base64 data URL of the logo image (or null)
 * @param websiteUrl - The company's website URL (or empty string)
 * @returns SafeColorResult with final primary/secondary colors and metadata
 */
export async function extractBrandColors(
  logoDataUrl: string | null | undefined,
  websiteUrl: string | undefined,
): Promise<SafeColorResult> {
  const warnings: string[] = [];

  // ── Step 1: Logo Extraction ──────────────────────────────────────────────
  let logoPrimary: string | null = null;
  let logoSecondary: string | null = null;

  if (logoDataUrl) {
    try {
      const logoColors = await extractColorsFromImage(logoDataUrl);
      logoPrimary = logoColors.primary;
      logoSecondary = logoColors.secondary;
    } catch (err) {
      warnings.push("Logo color extraction failed");
      console.warn("Logo extraction error:", err);
    }
  }

  // ── Step 2: Website Extraction ───────────────────────────────────────────
  let sitePrimary: string | null = null;
  let siteSecondary: string | null = null;
  let siteConfidence = 0;
  let siteWeakExtraction = true;
  let siteCandidates: NonNullable<SiteColorResponse["data"]>["candidates"] = [];

  if (websiteUrl?.trim()) {
    try {
      const res = await fetch("/api/extract-site-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl.trim() }),
      });

      if (res.ok) {
        const json: SiteColorResponse = await res.json();
        if (json.success && json.data) {
          sitePrimary = json.data.primary;
          siteSecondary = json.data.secondary;
          siteConfidence = json.data.confidence;
          siteWeakExtraction = json.data.weakExtraction;
          siteCandidates = json.data.candidates || [];
        } else {
          warnings.push("Website color extraction returned no data");
        }
      } else {
        // Try to read the server error for better diagnostics
        let serverDetail = "";
        try {
          const errJson = await res.json();
          serverDetail = errJson?.details || errJson?.error || "";
        } catch {}
        warnings.push(
          `Website extraction failed${serverDetail ? `: ${serverDetail}` : " — the site may be unreachable or block automated visits."}`,
        );
      }
    } catch (err: any) {
      warnings.push(
        `Website extraction network error: ${err?.message || "Could not reach the extraction service."}`,
      );
      console.warn("Site extraction error:", err);
    }
  }

  // ── Step 3: Cross-Check ──────────────────────────────────────────────────
  let comparison: ColorComparisonResult | null = null;
  let extractionSource: ExtractionSource = "manual";
  let confidence: ExtractionConfidence = "low";
  let needsManualReview = false;
  let finalPrimary = logoPrimary || sitePrimary || "#1F3A60";
  let finalSecondary = logoSecondary || siteSecondary || "#3A6EA5";

  // Determine the source and confidence based on what data we have
  const hasLogo = !!logoPrimary;
  const hasSite = !!sitePrimary && !siteWeakExtraction;

  // Check if the logo-extracted color is essentially neutral (near-black or
  // near-white). Many logos use black/dark artwork or white elements — their
  // dominant pixel color isn't a brand color.  When this happens, we should
  // defer to the site extraction instead of triggering a "needs review" flag.
  const logoIsNeutral =
    hasLogo &&
    logoPrimary &&
    (luminance(logoPrimary) < 0.15 || luminance(logoPrimary) > 0.85);

  if (hasLogo && hasSite && logoIsNeutral) {
    // Logo color is neutral (black/white/near) — defer to site color
    extractionSource = "website";
    confidence = "medium";
    finalPrimary = sitePrimary!;
    finalSecondary = siteSecondary || logoSecondary || "#3A6EA5";
    warnings.push(
      `Logo color (${logoPrimary}) is neutral (not a brand color). Using site extraction (${sitePrimary}) instead.`,
    );
  } else if (hasLogo && hasSite) {
    // Both sources available → cross-check
    comparison = compareColors(logoPrimary!, sitePrimary!, CLOSE_THRESHOLD);

    if (comparison.isClose) {
      // Logo and site agree → high confidence
      extractionSource = "both-agree";
      confidence = "high";
      finalPrimary = sitePrimary!;
      finalSecondary = siteSecondary || logoSecondary || "#3A6EA5";
    } else if (comparison.deltaE <= DIVERGE_THRESHOLD) {
      // Moderate divergence → flag for manual review, prefer site
      extractionSource = "website";
      confidence = "medium";
      needsManualReview = true;
      finalPrimary = sitePrimary!;
      finalSecondary = siteSecondary || logoSecondary || "#3A6EA5";
      warnings.push(
        `Logo color (${logoPrimary}) and site color (${sitePrimary}) differ (ΔE=${comparison.deltaE}). Using site extraction; manual review recommended.`,
      );
    } else {
      // Strong divergence → needs AI or manual review
      extractionSource = "website";
      confidence = "needs-review";
      needsManualReview = true;
      finalPrimary = sitePrimary!;
      finalSecondary = siteSecondary || logoSecondary || "#3A6EA5";
      warnings.push(
        `Logo color (${logoPrimary}) and site color (${sitePrimary}) strongly differ (ΔE=${comparison.deltaE}). Manual review required.`,
      );
    }
  } else if (hasSite) {
    // Site only → medium confidence
    extractionSource = "website";
    confidence = siteWeakExtraction ? "low" : "medium";
    finalPrimary = sitePrimary!;
    finalSecondary = siteSecondary || "#3A6EA5";
    if (siteWeakExtraction) {
      warnings.push("Website extraction was weak — colors may not be accurate.");
    }
  } else if (hasLogo) {
    // Logo only → medium-low confidence
    extractionSource = "logo";
    confidence = logoIsNeutral ? "low" : "medium";
    finalPrimary = logoPrimary!;
    finalSecondary = logoSecondary || "#3A6EA5";
    if (logoIsNeutral) {
      warnings.push(
        `Logo color (${logoPrimary}) appears neutral — may not represent brand colors accurately.`,
      );
    } else {
      warnings.push("No website data available. Colors based on logo only.");
    }
  } else {
    // Neither source available → fallback defaults
    extractionSource = "manual";
    confidence = "low";
    finalPrimary = "#1F3A60";
    finalSecondary = "#3A6EA5";
    warnings.push("No logo or website data. Using default colors.");
  }

  // ── Step 4: Safety Pass ──────────────────────────────────────────────────
  const primarySafety = safetyPass(finalPrimary);
  const secondarySafety = safetyPass(finalSecondary);

  // Use adjusted colors if WCAG failed
  const safePrimary = primarySafety.adjustedColor || primarySafety.snapped;
  const safeSecondary = secondarySafety.adjustedColor || secondarySafety.snapped;

  if (primarySafety.adjustedColor) {
    warnings.push(
      `Primary color adjusted from ${primarySafety.snapped} to ${primarySafety.adjustedColor} to meet WCAG AA contrast (4.5:1).`,
    );
  }
  if (secondarySafety.adjustedColor) {
    warnings.push(
      `Secondary color adjusted from ${secondarySafety.snapped} to ${secondarySafety.adjustedColor} to meet WCAG AA contrast (4.5:1).`,
    );
  }

  return {
    primary: safePrimary,
    secondary: safeSecondary,
    extraction: {
      source: extractionSource,
      primary: finalPrimary,
      secondary: finalSecondary,
      confidence,
      needsManualReview,
      logoColor: logoPrimary || undefined,
      siteColor: sitePrimary || undefined,
      deltaE: comparison?.deltaE,
      warnings,
    },
    safety: {
      primary: primarySafety,
      secondary: secondarySafety,
    },
    comparison,
    siteUrl: websiteUrl?.trim() || undefined,
  };
}

/**
 * Lightweight version: just run the safety pass on two hex colors.
 * Used when the user manually picks colors and we want to validate them.
 */
export function validateManualColors(
  primary: string,
  secondary: string,
): {
  primary: ColorSafetyResult;
  secondary: ColorSafetyResult;
  warnings: string[];
} {
  const primarySafety = safetyPass(primary);
  const secondarySafety = safetyPass(secondary);
  const warnings: string[] = [];

  if (!primarySafety.passesWCAG) {
    warnings.push(
      `"${primary}" fails WCAG AA contrast. Consider "${primarySafety.adjustedColor || primarySafety.snapped}".`,
    );
  }
  if (!secondarySafety.passesWCAG) {
    warnings.push(
      `"${secondary}" fails WCAG AA contrast. Consider "${secondarySafety.adjustedColor || secondarySafety.snapped}".`,
    );
  }

  return { primary: primarySafety, secondary: secondarySafety, warnings };
}

// ── AI suggestion extraction (3 suggestions from logo + website) ─────────────

export type ColorSetId = "ai-1" | "ai-2" | "ai-3";

/** Ordered AI suggestion ids used to render the three generated sets. */
const AI_SET_IDS: ColorSetId[] = ["ai-1", "ai-2", "ai-3"];

/** Ordered UI labels for the three generated AI suggestions. */
const AI_SET_LABELS = ["Suggestion #1", "Suggestion #2", "Suggestion #3"];

export interface ColorSetSuggestion {
  id: ColorSetId;
  label: string;
  primary: string;
  secondary: string;
  confidence: ExtractionConfidence;
  warnings: string[];
  available: boolean;
  unavailableReason?: string;
  /** The source URL used for extraction (e.g. the website scanned). */
  sourceUrl?: string;
  /** An image preview of the source (e.g. the logo thumbnail). */
  previewUrl?: string;
}

interface RawColorPair {
  primary: string;
  secondary: string;
}

/** Normalize a hex color to uppercase #RRGGBB without snapping to a preset. */
function normalizeHexColor(hex: string): string {
  const v = String(hex || "").trim();
  if (!v) return "";
  return v.startsWith("#") ? v.toUpperCase() : `#${v.toUpperCase()}`;
}

/**
 * Keep the extracted colors as-is (uppercase hex). The logo/website sets must
 * reflect colors that actually exist in the source, so they are NOT snapped to
 * corporate presets — snapping muted/slate hues to a preset was producing
 * colors (e.g. Slate Gray or Steel Blue) that weren't in the logo at all.
 */
function finalizePair(primary: string, secondary: string): RawColorPair {
  return {
    primary: normalizeHexColor(primary),
    secondary: normalizeHexColor(secondary),
  };
}

/**
 * Fallback palette used when the AI call is unavailable. These are distinct,
 * corporate-safe pairs chosen to produce three clearly different options.
 */
const FALLBACK_PAIRS: RawColorPair[] = [
  { primary: "#1F3A60", secondary: "#3A6EA5" },
  { primary: "#0F6D66", secondary: "#E5A100" },
  { primary: "#2C5F2D", secondary: "#D71E28" },
];

/**
 * Build up to three deterministic color suggestions from the logo and website
 * extractions. Used as a fallback when the AI endpoint is unavailable so the
 * user still gets three distinct options.
 */
function buildDeterministicSuggestions(
  logo: RawColorPair | null,
  website: RawColorPair | null,
): RawColorPair[] {
  const cross =
    logo || website
      ? {
          primary: website?.primary || logo?.primary || "#1F3A60",
          secondary: logo?.secondary || website?.secondary || "#3A6EA5",
        }
      : null;
  const crossSwapped =
    logo || website
      ? {
          primary: logo?.primary || website?.primary || "#1F3A60",
          secondary: website?.secondary || logo?.secondary || "#3A6EA5",
        }
      : null;

  const candidates: Array<RawColorPair | null> = [
    website,
    logo,
    cross,
    crossSwapped,
    ...FALLBACK_PAIRS,
  ];

  const suggestions: RawColorPair[] = [];
  const usedPrimaries: string[] = [];

  const tryPush = (candidate: RawColorPair | null | undefined): boolean => {
    if (!candidate) return false;
    const pair = finalizePair(candidate.primary, candidate.secondary);
    const primary = pair.primary?.toUpperCase();
    const secondary = pair.secondary?.toUpperCase();
    if (!primary || !secondary) return false;
    if (primary === secondary) return false;
    // Keep each suggestion's primary perceptually distinct from the others.
    if (usedPrimaries.some((used) => deltaE(used, primary) < 5)) return false;
    usedPrimaries.push(primary);
    suggestions.push(pair);
    return true;
  };

  for (const candidate of candidates) {
    tryPush(candidate);
    if (suggestions.length === 3) break;
  }

  // The palette guarantees three distinct primaries even if the extractions
  // overlap with each other or with the fallback palette.
  for (const fallback of FALLBACK_PAIRS) {
    if (suggestions.length === 3) break;
    tryPush(fallback);
  }

  // Absolute safety net (should never be reached with the distinct palette).
  let i = 0;
  while (suggestions.length < 3) {
    const fallback = FALLBACK_PAIRS[i % FALLBACK_PAIRS.length];
    suggestions.push(finalizePair(fallback.primary, fallback.secondary));
    i++;
  }

  return suggestions.slice(0, 3);
}

/**
 * Extract three AI brand color suggestions built from the logo and website
 * extractions so the user can choose the direction that best fits their brand:
 *   - "ai-1" — "Suggestion #1"
 *   - "ai-2" — "Suggestion #2"
 *   - "ai-3" — "Suggestion #3"
 *
 * The logo and website are still extracted first, but their raw colors are now
 * inputs to the AI rather than selectable options themselves. When the AI is
 * unavailable, three deterministic suggestions are generated from the same
 * logo + website inputs.
 */
export async function extractColorSets(
  logoDataUrl: string | null | undefined,
  websiteUrl: string | undefined,
  organizationName?: string,
  onSiteTypeDetected?: (info: SiteTechInfo | null) => void,
): Promise<ColorSetSuggestion[]> {
  const sets: ColorSetSuggestion[] = [];

  // ── 1. Logo extraction (input for AI) ───────────────────────────────────
  let logoColors: RawColorPair | null = null;
  if (logoDataUrl) {
    try {
      const raw = await extractColorsFromImage(logoDataUrl);
      logoColors = finalizePair(raw.primary, raw.secondary);
    } catch {
      // Keep null — the AI (or fallback) will work with whatever is available.
    }
  }

  // ── 2. Website extraction (input for AI) ────────────────────────────────
  let websiteColors: RawColorPair | null = null;
  if (websiteUrl?.trim()) {
    try {
      const res = await fetch("/api/extract-site-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl.trim() }),
      });

      if (res.ok) {
        const json: SiteColorResponse = await res.json();
        if (json.success && json.data) {
          // Surface the detected site tech for debugging/rollout (even when the
          // scan produced no colors — e.g. blocked or dark/neutral sites).
          onSiteTypeDetected?.(json.data.detectedType ?? null);
          if (json.data.primary) {
            websiteColors = finalizePair(
              json.data.primary,
              json.data.secondary || "",
            );
          }
        }
      }
    } catch {
      // Keep null — the AI (or fallback) will work with whatever is available.
    }
  }

  // ── 3. Three AI suggestions ─────────────────────────────────────────────
  if (logoColors || websiteColors) {
    let suggestions: RawColorPair[] | null = null;
    let usedFallback = false;

    try {
      const res = await fetch("/api/gemini/suggest-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoPrimary: logoColors?.primary || null,
          logoSecondary: logoColors?.secondary || null,
          websitePrimary: websiteColors?.primary || null,
          websiteSecondary: websiteColors?.secondary || null,
          organizationName: organizationName || "",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const parsed = Array.isArray(json?.suggestions)
          ? json.suggestions
          : [];
        if (parsed.length === 3) {
          const valid = parsed.every(
            (item: { primary?: unknown; secondary?: unknown }) =>
              item?.primary && item?.secondary,
          );
          if (valid) {
            suggestions = parsed.map(
              (item: { primary: string; secondary: string }) =>
                finalizePair(item.primary, item.secondary),
            );
          }
        }
      }
    } catch {
      // fall through to deterministic suggestions
    }

    if (!suggestions || suggestions.length !== 3) {
      suggestions = buildDeterministicSuggestions(logoColors, websiteColors);
      usedFallback = true;
    }

    suggestions.forEach((pair, index) => {
      sets.push({
        id: AI_SET_IDS[index],
        label: AI_SET_LABELS[index],
        primary: pair.primary,
        secondary: pair.secondary,
        confidence: usedFallback ? "low" : "high",
        warnings: usedFallback
          ? ["AI unavailable — generated three options from logo & website colors"]
          : [],
        available: true,
      });
    });
  } else {
    AI_SET_IDS.forEach((id, index) => {
      sets.push({
        id,
        label: AI_SET_LABELS[index],
        primary: "",
        secondary: "",
        confidence: "low",
        warnings: [],
        available: false,
        unavailableReason: "Needs a logo or website",
      });
    });
  }

  return sets;
}

// ── Re-exports for convenience ───────────────────────────────────────────────

export {
  compareColors,
  safetyPass,
  snapToNearestPreset,
  getPresetName,
  meetsWCAG,
  contrastRatio,
  deltaE,
  getContrastScores,
  WCAG_AA_NORMAL,
};
