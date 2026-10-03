/**
 * What is this Custom benefit called?
 *
 * A Custom benefit is stored under the category **"Company / Plan Sponsor"**, and the name
 * the advisor gave it lives in `Benefit.title` — the wizard's "Custom Category Name". That
 * storage key is a page key, not a name, so anywhere a Custom benefit is shown to a reader
 * the question "what is this one called?" has to be answered the same way: the page header's
 * subtitle, the Benefits list row, and the wizard's own field all ask it.
 *
 * Client-safe on purpose. The server's copy of the key lives in
 * [`benefit-categories.server.ts`](lib/teammates/benefit-categories.server.ts), which imports
 * Prisma and must never be pulled into a browser bundle.
 */

/** The category a Custom benefit is stored under. Mirrors lib/save-benefit. */
export const CUSTOM_BENEFIT_CATEGORY = "Company / Plan Sponsor";

/**
 * Longest a benefit's name may be.
 *
 * A Custom benefit's name is stored in `Benefit.title` — the SAME column the Messaging **Intro
 * Headline** writes for the canonical categories, which has always been capped at 35. The Custom
 * Category Name therefore carries the identical cap: a value that is accepted in one field cannot
 * be too long for the other, and both end up rendered in the same headline slot on the portal.
 */
export const BENEFIT_TITLE_MAX_LENGTH = 35;

/**
 * Is this the Custom hub?
 *
 * Every spelling in play is accepted: the stored label, the wizard's `"Custom"`, and a
 * slash-spacing variant — because the value arrives from URLs, the database and free text,
 * and "Company/Plan Sponsor" is the same thing to a reader. `normalizeContactCategory`
 * already treats `"custom"` and `"company / plan sponsor"` as one category, but it leaves
 * punctuation alone, so the spacing is flattened here.
 */
export function isCustomHubCategory(
  category: string | null | undefined,
): boolean {
  const value = (category || "").trim().toLowerCase().replace(/\s*\/\s*/g, "/");
  if (!value) return false;
  if (value === "custom") return true;
  return (
    value === CUSTOM_BENEFIT_CATEGORY.toLowerCase().replace(/\s*\/\s*/g, "/")
  );
}

/**
 * Is this one of the wizard's OWN strings rather than a name the advisor chose?
 *
 * Two things land in `Benefit.title` without anybody having named the benefit:
 *
 *  - the hub's storage label, written back by an older save path (and by the fallback in
 *    Edit Benefit's own hydration, which seeds `benefitTitle` with the category);
 *  - the intro-headline default, which is always "Welcome to …" and used to be seeded into
 *    the Custom Category Name field before the Benefit rows snapshot arrived.
 *
 * Both read as placeholders in a heading, so both are treated as "no name yet".
 */
export function isPlaceholderBenefitName(
  value: string | null | undefined,
): boolean {
  const name = (value || "").trim();
  if (!name) return true;
  if (isCustomHubCategory(name)) return true;
  return /^welcome to\b/i.test(name);
}

/**
 * The name to show for a category in a heading.
 *
 * Every category except the hub names itself. The hub shows the advisor's own name, or
 * "Custom" while there is not one — never "Company / Plan Sponsor", which told the reader
 * nothing about which benefit they were looking at.
 */
export function displayCategoryName(
  category: string | null | undefined,
  benefitTitle: string | null | undefined,
): string {
  const stored = (category || "").trim();
  if (!isCustomHubCategory(stored)) return stored;
  const name = (benefitTitle || "").trim();
  return isPlaceholderBenefitName(name) ? "Custom" : name;
}

/*
 * ── Portal route segment ────────────────────────────────────────────────────
 *
 * The Custom benefit's portal page used to live at a fixed `/wellness-programs`
 * segment. It is now addressed by the advisor's own name for the benefit, so the URL
 * reads like the benefit ("/acme/mindfulness-and-me" rather than "/acme/wellness-
 * programs"). The legacy segment is still accepted everywhere so links already
 * published — hub buttons, stored webinar placements, bookmarks — keep resolving.
 */

/** The portal route segment the Custom benefit is still reachable at (legacy alias). */
export const CUSTOM_BENEFIT_LEGACY_SLUG = "wellness-programs";

/**
 * URL slug for a Custom benefit name — lowercase, hyphenated, punctuation dropped.
 *
 * Returns "" when there is nothing nameable, so a caller can fall back to the legacy
 * segment instead of linking to "/".
 */
export function customBenefitNameToSlug(name?: string | null): string {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The route segment the Custom benefit should link to: its name's slug, or the legacy alias. */
export function customBenefitRouteSlug(name?: string | null): string {
  return customBenefitNameToSlug(name) || CUSTOM_BENEFIT_LEGACY_SLUG;
}

/**
 * Does `segment` resolve to this plan's Custom benefit hub?
 *
 * Accepts the name's slug AND the legacy segment, so old links keep working. A
 * placeholder name (the storage label, or the "Welcome to …" headline default) has no
 * slug of its own, so only the legacy segment matches.
 */
export function isCustomBenefitRouteSegment(
  segment: string | null | undefined,
  name?: string | null,
): boolean {
  const value = decodeURIComponent((segment || "").trim());
  if (!value) return false;
  if (value === CUSTOM_BENEFIT_LEGACY_SLUG) return true;
  if (isPlaceholderBenefitName(name)) return false;
  return value === customBenefitNameToSlug(name);
}
