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

/**
 * Corner treatment bundled with a typography theme.
 *
 * A theme is no longer only fonts: it also decides the portal's shape language.
 * `sharp` squares every rounded utility off (0 radius); `round` keeps a subtle
 * rounding. Both leave `rounded-full` circular — a circle is a shape, not a
 * corner — so avatars, pills and status dots stay as designed.
 */
export type TypographyShape = "sharp" | "round";

/** The three font roles a theme assigns. */
export type TypographyRole = "headline" | "body" | "ui";

export interface TypographyTheme {
  id: TypographyThemeId;
  /** Display name shown in the selector. */
  label: string;
  /** One-line description shown under the label. */
  description: string;
  /** Corner treatment this theme applies to the portal's UI. */
  shape: TypographyShape;
  /**
   * Resolved base corner radius, published to the portal as
   * `--portal-radius` (see `getPortalShapeCssVars`). `0px` for `sharp`.
   */
  radius: string;
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

/**
 * Corner radii, as the resolved `--portal-radius` value.
 *
 * `round` is a step up from the app's base 0.5rem so the difference from `sharp`
 * reads immediately without turning cards into lozenges.
 */
const SHARP_RADIUS = "0px";
const ROUND_RADIUS = "0.75rem";

export const TYPOGRAPHY_THEMES: Record<TypographyThemeId, TypographyTheme> = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Timeless serif headlines paired with a clean, modern body.",
    shape: "sharp",
    radius: SHARP_RADIUS,
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
    shape: "round",
    radius: ROUND_RADIUS,
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
    shape: "round",
    radius: ROUND_RADIUS,
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
    shape: "sharp",
    radius: SHARP_RADIUS,
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
 * Build the CSS custom properties for a theme's FONTS. Spread onto the portal
 * container's `style` (or applied to a preview root) to activate the theme for
 * that subtree.
 *
 * Corner treatment is deliberately NOT part of this object: it is also applied
 * to `document.documentElement` while an editor is open (see
 * `applyTypographyToElement`), and a global radius would reshape the dashboard.
 * Use `getPortalShapeCssVars` / `getPortalThemeCssVars` for the portal surfaces.
 */
export function getTypographyCssVars(id?: string | null): TypographyCssVars {
  const theme = resolveTypographyTheme(id);
  return {
    "--font-headline": theme.headline,
    "--font-body": theme.body,
    "--font-ui": theme.ui,
  };
}

/** The custom property that drives the portal's corner radius. */
export interface PortalShapeCssVars {
  "--portal-radius": string;
}

/**
 * Build the shape custom property for a theme. Set it on a portal container (or
 * a preview root) — anywhere it is set, the `rounded-*` utilities below it read
 * the theme's radius instead of the app's base `--radius`.
 */
export function getPortalShapeCssVars(
  id?: string | null,
): PortalShapeCssVars {
  return { "--portal-radius": resolveTypographyTheme(id).radius };
}

/** Fonts + shape — everything the portal root needs from a theme. */
export function getPortalThemeCssVars(
  id?: string | null,
): TypographyCssVars & PortalShapeCssVars {
  return { ...getTypographyCssVars(id), ...getPortalShapeCssVars(id) };
}

/**
 * The theme's corner radius as a CSS value, at a multiple of the base step.
 *
 * Most portal UI leans on the `rounded-*` utilities (see tailwind.config.js),
 * which already read `--portal-radius`. Sections that draw a surface the
 * utility set has no class for — the welcome banner's hero card, the journey
 * video frame, the document grid cards, the contact cards — use this instead,
 * so the typography theme's shape reaches them too:
 *
 *   sharp → `calc(0px * 2)` = 0 (perfectly square)
 *   round → `calc(0.75rem * 2)` = 1.5rem
 *
 * `scale` mirrors the utility steps: 1 = `lg`, 1.5 = `xl`, 2 = `2xl`.
 */
export function portalRadiusValue(scale = 1): string {
  const base = "var(--portal-radius, var(--radius))";
  return scale === 1 ? base : `calc(${base} * ${scale})`;
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
