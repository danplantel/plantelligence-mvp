/**
 * Website typography extraction (pure functions, no side effects).
 *
 * Turns raw HTML/CSS into compact typography signals that can be:
 *   - mapped deterministically to a portal typography theme, or
 *   - handed to Gemini for a judged recommendation.
 *
 * Kept dependency-free — like `lib/site-tech-detection.ts` — so it runs in the
 * server route and can be reasoned about in isolation.
 *
 * The signals deliberately stay small (font names + counts, not the page) so we
 * never ship a customer's whole stylesheet to the model.
 */

import type { TypographyThemeId } from "./typography-themes";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FontSignal {
  /** Normalised family name, e.g. "Playfair Display". */
  family: string;
  /** How many times the family appeared across the page's CSS. */
  count: number;
  /** Heuristic: does the family read as a serif face? */
  serif: boolean;
}

export interface TypographySignals {
  /** Every font family found, most-used first. */
  fonts: FontSignal[];
  /** Families assigned to heading selectors (h1-h6, or heading/title/display classes). */
  headingFonts: string[];
  /** Families assigned to body-level selectors (body/html/p, or body/copy/text classes). */
  bodyFonts: string[];
  /** Families requested from Google Fonts links or @import rules. */
  linkedFonts: string[];
  /** True when any signal reads as a serif face. */
  hasSerif: boolean;
  /** True when the page yielded no usable font data. */
  empty: boolean;
}

export interface TypographyThemeSuggestion {
  theme: TypographyThemeId;
  /** Short, human-readable justification shown next to the suggestion. */
  reason: string;
  confidence: "high" | "medium" | "low";
  source: "ai" | "heuristic";
}

// ── Font classification ──────────────────────────────────────────────────────

/** Well-known serif faces (lowercased) used for the serif heuristic. */
const SERIF_FAMILIES = new Set([
  "abril fatface",
  "alegreya",
  "amiri",
  "arvo",
  "bitter",
  "bodoni moda",
  "cardo",
  "cormorant",
  "cormorant garamond",
  "cormorant infant",
  "crete round",
  "crimson pro",
  "crimson text",
  "dm serif display",
  "dm serif text",
  "domine",
  "eb garamond",
  "eczar",
  "fraunces",
  "garamond",
  "gelasio",
  "georgia",
  "josefin slab",
  "libre baskerville",
  "libre caslon display",
  "libre caslon text",
  "literata",
  "lora",
  "lusitana",
  "merriweather",
  "neuton",
  "newsreader",
  "noto serif",
  "petrona",
  "playfair display",
  "prata",
  "pt serif",
  "roboto slab",
  "rosarivo",
  "source serif 4",
  "source serif pro",
  "spectral",
  "tiro",
  "times",
  "times new roman",
  "vollkorn",
  "yeseva one",
  "zilla slab",
]);

/** Generic CSS keywords / non-families that must not become signals. */
const IGNORED_FAMILIES = new Set([
  "auto",
  "blinkmacsystemfont",
  "cursive",
  "emoji",
  "fantasy",
  "inherit",
  "initial",
  "math",
  "monospace",
  "none",
  "revert",
  "sans",
  "sans serif",
  "sans-serif",
  "serif",
  "system-ui",
  "ui-monospace",
  "ui-rounded",
  "ui-sans-serif",
  "ui-serif",
  "unset",
  "-apple-system",
]);

function isSerifFamily(family: string): boolean {
  const f = family.toLowerCase();
  if (f.includes("sans")) return false;
  if (SERIF_FAMILIES.has(f)) return true;
  // Generic-but-explicit markers in custom faces, e.g. "Acme Serif", "Foo Slab".
  return f.includes("serif") || f.includes("slab");
}

/** Normalise a single family name taken from a font stack. */
function normalizeFamily(raw: string): string | null {
  let name = raw.trim().replace(/^["']|["']$/g, "").trim();
  if (!name) return null;
  // Drop CSS functions (var(--x), clamp(), etc.) — we cannot resolve them here.
  if (name.includes("(") || name.includes(")")) return null;
  name = name.replace(/\s+/g, " ");
  const lower = name.toLowerCase();
  if (IGNORED_FAMILIES.has(lower)) return null;
  if (lower.length > 48) return null;
  // Keep the original casing, but title-case all-lowercase names so the model
  // sees "Playfair Display" rather than "playfair display".
  if (lower === name) {
    name = name.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return name;
}

/**
 * Split a `font-family` declaration value into normalised family names.
 * `"Playfair Display", Georgia, serif` becomes ["Playfair Display", "Georgia"].
 */
function familiesFromDeclaration(value: string): string[] {
  return value
    .split(",")
    .map(normalizeFamily)
    .filter((f): f is string => !!f);
}

// ── Selector classification ──────────────────────────────────────────────────

const HEADING_SELECTOR_RE = /\b(h[1-6]|heading|headline|title|display)\b/i;
const BODY_SELECTOR_RE = /\b(body|html|main|p|copy|paragraph|text|content)\b/i;

// ── Extraction ───────────────────────────────────────────────────────────────

const FAMILY_DECL_RE = /font-family\s*:\s*([^;}]+)/gi;
// The selector charset excludes markup punctuation (`<`, `>`, quotes, `@`, `=`,
// `;`) so a rule can never be captured together with the HTML that precedes it.
// Without this, an earlier `<link href="...&display=swap">` leaks the word
// "display" into the selector and misclassifies a `body` rule as a heading.
const RULE_RE = /([^{}<>"'@=;]+)\{([^{}]*)\}/g;
const GOOGLE_FAMILY_RE = /[?&]family=([^&"'\\]+)/gi;

/** Parse Google Fonts `family=` parameters (handles `+`, `|` and axis suffixes). */
function extractLinkedFonts(html: string): string[] {
  if (!/fonts\.googleapis\.com/i.test(html)) return [];
  const found = new Set<string>();
  for (const match of html.matchAll(GOOGLE_FAMILY_RE)) {
    for (const part of match[1].split("|")) {
      // Strip the variable-axis suffix, e.g. "Outfit:wght@400..900".
      const base = part.split(":")[0].replace(/\+/g, " ").trim();
      const family = normalizeFamily(decodeURIComponent(base));
      if (family) found.add(family);
    }
  }
  return Array.from(found);
}

/**
 * Extract typography signals from a page's HTML (including any inline CSS it
 * embeds). External stylesheets are intentionally not fetched: page-level
 * `font-family` usage, heading rules and Google Fonts links are enough to pick
 * a theme, and it keeps this to a single request.
 */
export function extractTypographySignals(html: string): TypographySignals {
  const source = html || "";
  const counts = new Map<string, number>();
  const headingFonts = new Set<string>();
  const bodyFonts = new Set<string>();

  const bump = (family: string) => {
    counts.set(family, (counts.get(family) || 0) + 1);
  };

  // 1. Rule-scoped declarations — gives us heading vs body intent.
  for (const rule of source.matchAll(RULE_RE)) {
    const selector = rule[1];
    const declarations = rule[2];
    if (!/font-family/i.test(declarations)) continue;

    const families: string[] = [];
    for (const decl of declarations.matchAll(FAMILY_DECL_RE)) {
      families.push(...familiesFromDeclaration(decl[1]));
    }
    if (families.length === 0) continue;

    families.forEach(bump);

    if (HEADING_SELECTOR_RE.test(selector)) {
      families.forEach((f) => headingFonts.add(f));
    } else if (BODY_SELECTOR_RE.test(selector)) {
      families.forEach((f) => bodyFonts.add(f));
    }
  }

  // 2. Any remaining declarations (inline styles, stray CSS text).
  for (const decl of source.matchAll(FAMILY_DECL_RE)) {
    for (const family of familiesFromDeclaration(decl[1])) bump(family);
  }

  // 3. Google Fonts requests.
  const linkedFonts = extractLinkedFonts(source);
  linkedFonts.forEach(bump);

  const fonts: FontSignal[] = Array.from(counts.entries())
    .map(([family, count]) => ({ family, count, serif: isSerifFamily(family) }))
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));

  return {
    fonts,
    headingFonts: Array.from(headingFonts),
    bodyFonts: Array.from(bodyFonts),
    linkedFonts,
    hasSerif: fonts.some((f) => f.serif),
    empty: fonts.length === 0,
  };
}

// ── Deterministic mapping ────────────────────────────────────────────────────

/** First serif family within a list, if any. */
function pickSerif(families: string[]): string | null {
  return families.find((f) => isSerifFamily(f)) || null;
}

/** First sans-serif family within a list, if any. */
function pickSans(families: string[]): string | null {
  return families.find((f) => !isSerifFamily(f)) || null;
}

/**
 * Map typography signals onto one of the four portal themes.
 *
 * Theme shape:
 *   classic      = serif headline + sans body
 *   modern       = sans  headline + sans body
 *   editorial    = serif headline + serif body
 *   contemporary = sans  headline + serif body
 *
 * Used as the fallback when Gemini is unavailable, and to sanity-check an AI
 * answer that cannot be parsed.
 */
export function inferThemeFromSignals(
  signals: TypographySignals,
): TypographyThemeSuggestion {
  if (signals.empty) {
    return {
      theme: "classic",
      reason:
        "No font information could be read from the site, so the default Classic theme is suggested.",
      confidence: "low",
      source: "heuristic",
    };
  }

  // Prefer explicit heading/body rules; fall back to the most-used families.
  const headingCandidate =
    pickSerif(signals.headingFonts) ||
    pickSans(signals.headingFonts) ||
    signals.headingFonts[0] ||
    null;
  const bodyCandidate =
    pickSerif(signals.bodyFonts) ||
    pickSans(signals.bodyFonts) ||
    signals.bodyFonts[0] ||
    null;

  const ranked = signals.fonts;
  const headlineFamily = headingCandidate || ranked[0]?.family || null;
  const bodyFamily =
    bodyCandidate ||
    ranked.find((f) => f.family !== headlineFamily)?.family ||
    headlineFamily;

  const headlineSerif = headlineFamily ? isSerifFamily(headlineFamily) : false;
  const bodySerif = bodyFamily ? isSerifFamily(bodyFamily) : false;

  const label = (f: string | null, fallback: string) => f || fallback;

  if (headlineSerif && bodySerif) {
    return {
      theme: "editorial",
      reason: `Both headings and body copy use serif faces (${label(
        headlineFamily,
        "serif",
      )} / ${label(bodyFamily, "serif")}), matching the Editorial pairing.`,
      confidence: headingCandidate && bodyCandidate ? "high" : "medium",
      source: "heuristic",
    };
  }

  if (headlineSerif) {
    return {
      theme: "classic",
      reason: `Serif headings (${label(
        headlineFamily,
        "serif",
      )}) with sans-serif body copy (${label(
        bodyFamily,
        "sans-serif",
      )}) match the Classic pairing.`,
      confidence: headingCandidate ? "high" : "medium",
      source: "heuristic",
    };
  }

  if (bodySerif) {
    return {
      theme: "contemporary",
      reason: `Sans-serif headings (${label(
        headlineFamily,
        "sans-serif",
      )}) with serif body copy (${label(
        bodyFamily,
        "serif",
      )}) match the Contemporary pairing.`,
      confidence: bodyCandidate ? "medium" : "low",
      source: "heuristic",
    };
  }

  return {
    theme: "modern",
    reason: `Sans-serif headings and body copy (${label(
      headlineFamily,
      "sans-serif",
    )}) match the Modern pairing.`,
    confidence: headingCandidate || bodyCandidate ? "high" : "medium",
    source: "heuristic",
  };
}

/** Compact, model-friendly view of the signals (keeps the prompt small). */
export function summarizeSignalsForModel(signals: TypographySignals) {
  return {
    top_fonts: signals.fonts.slice(0, 8).map((f) => ({
      family: f.family,
      uses: f.count,
      serif: f.serif,
    })),
    heading_fonts: signals.headingFonts.slice(0, 6),
    body_fonts: signals.bodyFonts.slice(0, 6),
    google_fonts: signals.linkedFonts.slice(0, 8),
  };
}
