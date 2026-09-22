// Portal typography themes.
//
// A "typography theme" bundles three font roles that are applied to the
// employee-facing Client Portal only (never the dashboard):
//
//   • headline → H1/H2/H3, large section titles, hero messaging
//   • body     → paragraphs, educational copy, descriptions, long-form text
//   • ui       → navigation, buttons, form labels, inputs, dropdowns, tabs,
//                small labels and utility text. This is ALWAYS Outfit so the
//                functional experience stays consistent across themes.
//
// The four families (Playfair Display, Sora, Lora, Outfit) are loaded via
// `next/font/google` in `app/layout.tsx`, which self-hosts them at build time
// and exposes the CSS variables referenced below.
//
// The resolved theme is applied by setting three CSS custom properties on the
// portal container (see `app/(portal)/[id]/layout.tsx`). The `--font-*`
// variables live on `:root` (see `app/globals.css`) with the legacy DM Serif /
// Red Hat / Manrope stacks as fallbacks, so any surface that does not opt into
// a theme — including the whole dashboard — renders exactly as before.

export type TypographyThemeId =
  | "classic"
  | "modern"
  | "editorial"
  | "contemporary";

/** The three font roles a theme assigns. */
export type TypographyRole = "headline" | "body" | "ui";

export interface TypographyTheme {
  id: TypographyThemeId;
  /** Display name shown in the selector. */
  label: string;
  /** One-line description shown under the label. */
  description: string;
  /** Resolved `font-family` stack for headings. */
  headline: string;
  /** Resolved `font-family` stack for body copy. */
  body: string;
  /** Resolved `font-family` stack for UI chrome. Always Outfit. */
  ui: string;
  /** Human-readable headline font name (used in previews/labels). */
  headlineName: string;
  /** Human-readable body font name (used in previews/labels). */
  bodyName: string;
}

// ── Font stacks ─────────────────────────────────────────────────────────────
// Each stack references the next/font variable for the family, followed by a
// sensible system fallback for the brief window before the webfont loads.

// Each `var()` carries an inline fallback so the stack stays valid even if the
// custom property is missing at the element where the theme is applied (a
// missing custom property otherwise makes the whole font-family declaration
// invalid at computed-value time, silently dropping the font).
const PLAYFAIR =
  "var(--font-playfair, 'Playfair Display'), Georgia, 'Times New Roman', serif";
const SORA =
  "var(--font-sora, Sora), system-ui, -apple-system, sans-serif";
const LORA = "var(--font-lora, Lora), Georgia, 'Times New Roman', serif";
const OUTFIT =
  "var(--font-outfit, Outfit), system-ui, -apple-system, sans-serif";

// ── Themes ──────────────────────────────────────────────────────────────────

export const TYPOGRAPHY_THEMES: Record<TypographyThemeId, TypographyTheme> = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Timeless serif headlines paired with a clean, modern body.",
    headline: PLAYFAIR,
    body: OUTFIT,
    ui: OUTFIT,
    headlineName: "Playfair Display",
    bodyName: "Outfit",
  },
  modern: {
    id: "modern",
    label: "Modern",
    description: "Contemporary sans-serif headlines with a clean body.",
    headline: SORA,
    body: OUTFIT,
    ui: OUTFIT,
    headlineName: "Sora",
    bodyName: "Outfit",
  },
  editorial: {
    id: "editorial",
    label: "Editorial",
    description: "Elegant serif headlines with a refined serif body.",
    headline: PLAYFAIR,
    body: LORA,
    ui: OUTFIT,
    headlineName: "Playfair Display",
    bodyName: "Lora",
  },
  contemporary: {
    id: "contemporary",
    label: "Contemporary",
    description: "Modern sans-serif headlines with a refined serif body.",
    headline: SORA,
    body: LORA,
    ui: OUTFIT,
    headlineName: "Sora",
    bodyName: "Lora",
  },
};

/** Ordered list for rendering the selector (matches the spec order). */
export const TYPOGRAPHY_THEME_LIST: TypographyTheme[] = [
  TYPOGRAPHY_THEMES.classic,
  TYPOGRAPHY_THEMES.modern,
  TYPOGRAPHY_THEMES.editorial,
  TYPOGRAPHY_THEMES.contemporary,
];

/** Theme used when a plan has no explicit selection (also the legacy default). */
export const DEFAULT_TYPOGRAPHY_THEME: TypographyThemeId = "classic";

/** Type guard for arbitrary persisted values. */
export function isTypographyThemeId(
  value: unknown,
): value is TypographyThemeId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(TYPOGRAPHY_THEMES, value)
  );
}

/**
 * Resolve a persisted theme id to a theme, falling back to the default
 * (`classic`) for unknown/empty values. Existing plans with no saved value
 * therefore render Classic without any backfill.
 */
export function resolveTypographyTheme(
  id?: string | null,
): TypographyTheme {
  return isTypographyThemeId(id)
    ? TYPOGRAPHY_THEMES[id]
    : TYPOGRAPHY_THEMES[DEFAULT_TYPOGRAPHY_THEME];
}

/** Normalize a persisted value to a concrete theme id (always valid). */
export function normalizeTypographyThemeId(
  id?: string | null,
): TypographyThemeId {
  return isTypographyThemeId(id) ? id : DEFAULT_TYPOGRAPHY_THEME;
}

// ── CSS variable plumbing ───────────────────────────────────────────────────

/** The custom properties the portal container sets to activate a theme. */
export interface TypographyCssVars {
  "--font-headline": string;
  "--font-body": string;
  "--font-ui": string;
}

/**
 * Build the CSS custom properties for a theme. Spread onto the portal
 * container's `style` (or applied to a preview root) to activate the theme for
 * that subtree.
 */
export function getTypographyCssVars(id?: string | null): TypographyCssVars {
  const theme = resolveTypographyTheme(id);
  return {
    "--font-headline": theme.headline,
    "--font-body": theme.body,
    "--font-ui": theme.ui,
  };
}

/**
 * Apply a theme's variables directly to a DOM element (e.g.
 * `document.documentElement` while a Step 2 preview is mounted, so iframe-based
 * mobile previews — which copy root custom properties — pick the theme up).
 * Returns a cleanup function that restores the previous values.
 */
export function applyTypographyToElement(
  element: HTMLElement | null | undefined,
  id?: string | null,
): () => void {
  if (!element) return () => {};
  const vars = getTypographyCssVars(id);
  const previous: Partial<TypographyCssVars> = {};
  (Object.keys(vars) as (keyof TypographyCssVars)[]).forEach((key) => {
    previous[key] = element.style.getPropertyValue(key) as TypographyCssVars[typeof key];
    element.style.setProperty(key, vars[key]);
  });
  return () => {
    (Object.keys(vars) as (keyof TypographyCssVars)[]).forEach((key) => {
      const prev = previous[key];
      if (prev) {
        element.style.setProperty(key, prev);
      } else {
        element.style.removeProperty(key);
      }
    });
  };
}

/** Convenience: the font stack for a single role within a theme. */
export function getTypographyFontFamily(
  id: string | null | undefined,
  role: TypographyRole,
): string {
  return resolveTypographyTheme(id)[role];
}
