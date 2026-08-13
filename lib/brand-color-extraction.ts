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

// ── Multi-set extraction (Logo / Website / AI) ──────────────────────────────

export type ColorSetId = "logo" | "website" | "ai";

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

/** Run the safety pass on both colors and return the final hex values. */
function finalizePair(primary: string, secondary: string): RawColorPair {
  const primarySafety = safetyPass(primary);
  const secondarySafety = safetyPass(secondary);
  return {
    primary: primarySafety.adjustedColor || primarySafety.snapped,
    secondary: secondarySafety.adjustedColor || secondarySafety.snapped,
  };
}

/**
 * Deterministic fallback for the AI set when the AI call is unavailable:
 * prefer the website colors, then the logo, and ensure the two colors are
 * visually distinct.
 */
function deterministicBlend(
  logo: RawColorPair | null,
  website: RawColorPair | null,
): RawColorPair {
  const primary = website?.primary || logo?.primary || "#1F3A60";
  let secondary = website?.secondary || logo?.secondary || "#3A6EA5";

  if (
    !secondary ||
    secondary.toUpperCase() === primary.toUpperCase() ||
    deltaE(primary, secondary) < 5
  ) {
    const alternates = [logo?.secondary, website?.secondary, "#3A6EA5"];
    secondary =
      alternates.find(
        (c) =>
          c &&
          c.toUpperCase() !== primary.toUpperCase() &&
          deltaE(primary, c) >= 5,
      ) || "#3A6EA5";
  }

  return { primary, secondary };
}

/**
 * Extract three independent brand color sets so the user can choose:
 *   - "logo"    — colors from the logo image only
 *   - "website" — colors from the live website only
 *   - "ai"      — Gemini suggestion combining logo + website + org name,
 *                 falling back to a deterministic blend when AI fails
 */
export async function extractColorSets(
  logoDataUrl: string | null | undefined,
  websiteUrl: string | undefined,
  organizationName?: string,
): Promise<ColorSetSuggestion[]> {
  const sets: ColorSetSuggestion[] = [];

  // ── 1. Logo set ─────────────────────────────────────────────────────────
  let logoColors: RawColorPair | null = null;
  if (logoDataUrl) {
    try {
      const raw = await extractColorsFromImage(logoDataUrl);
      logoColors = finalizePair(raw.primary, raw.secondary);
      sets.push({
        id: "logo",
        label: "From Logo",
        primary: logoColors.primary,
        secondary: logoColors.secondary,
        confidence: "medium",
        warnings: [],
        available: true,
        previewUrl: logoDataUrl,
      });
    } catch {
      sets.push({
        id: "logo",
        label: "From Logo",
        primary: "",
        secondary: "",
        confidence: "low",
        warnings: ["Logo color extraction failed"],
        available: false,
        unavailableReason: "Could not extract colors from the logo",
      });
    }
  } else {
    sets.push({
      id: "logo",
      label: "From Logo",
      primary: "",
      secondary: "",
      confidence: "low",
      warnings: [],
      available: false,
      unavailableReason: "No logo available",
    });
  }

  // ── 2. Website set ──────────────────────────────────────────────────────
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
        if (json.success && json.data?.primary) {
          websiteColors = finalizePair(
            json.data.primary,
            json.data.secondary || json.data.primary,
          );
          sets.push({
            id: "website",
            label: "From Website",
            primary: websiteColors.primary,
            secondary: websiteColors.secondary,
            confidence: json.data.weakExtraction ? "low" : "medium",
            warnings: json.data.weakExtraction
              ? ["Website extraction was weak"]
              : [],
            available: true,
            sourceUrl: websiteUrl.trim(),
          });
        } else {
          sets.push({
            id: "website",
            label: "From Website",
            primary: "",
            secondary: "",
            confidence: "low",
            warnings: ["Website extraction returned no colors"],
            available: false,
            unavailableReason: "No brand colors found on the website",
          });
        }
      } else {
        sets.push({
          id: "website",
          label: "From Website",
          primary: "",
          secondary: "",
          confidence: "low",
          warnings: ["Website extraction failed"],
          available: false,
          unavailableReason: "The website could not be reached",
        });
      }
    } catch {
      sets.push({
        id: "website",
        label: "From Website",
        primary: "",
        secondary: "",
        confidence: "low",
        warnings: ["Website extraction failed"],
        available: false,
        unavailableReason: "The website could not be reached",
      });
    }
  } else {
    sets.push({
      id: "website",
      label: "From Website",
      primary: "",
      secondary: "",
      confidence: "low",
      warnings: [],
      available: false,
      unavailableReason: "No website URL",
    });
  }

  // ── 3. AI set ───────────────────────────────────────────────────────────
  if (logoColors || websiteColors) {
    let aiColors: RawColorPair | null = null;
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
        if (json?.primary && json?.secondary) {
          aiColors = { primary: json.primary, secondary: json.secondary };
        }
      }
    } catch {
      // fall through to deterministic blend
    }

    if (!aiColors) {
      aiColors = deterministicBlend(logoColors, websiteColors);
      usedFallback = true;
    }

    const finalized = finalizePair(aiColors.primary, aiColors.secondary);
    sets.push({
      id: "ai",
      label: "AI Suggestion",
      primary: finalized.primary,
      secondary: finalized.secondary,
      confidence: usedFallback ? "low" : "high",
      warnings: usedFallback
        ? ["AI unavailable — used a blend of logo & website colors"]
        : [],
      available: true,
    });
  } else {
    sets.push({
      id: "ai",
      label: "AI Suggestion",
      primary: "",
      secondary: "",
      confidence: "low",
      warnings: [],
      available: false,
      unavailableReason: "Needs a logo or website",
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
