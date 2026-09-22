/**
 * URL-safe slugs for the four benefit categories.
 *
 * "Company / Plan Sponsor" contains a slash, and an encoded `%2F` inside an
 * App Router dynamic segment is unreliable (some servers normalise it back to a
 * path separator). The Edit Benefit route therefore carries the slug
 * (`/edit-benefit/<planId>/company-plan-sponsor`) and maps it back here.
 */
const CATEGORY_TO_SLUG: Record<string, string> = {
  Retirement: "retirement",
  "Group Health": "group-health",
  "Group Life": "group-life",
  "Company / Plan Sponsor": "company-plan-sponsor",
  // Legacy alias
  Custom: "company-plan-sponsor",
};

const SLUG_TO_CATEGORY: Record<string, string> = Object.entries(
  CATEGORY_TO_SLUG,
).reduce<Record<string, string>>((acc, [category, slug]) => {
  if (!acc[slug]) acc[slug] = category;
  return acc;
}, {});

/** Fallback for any category not in the map (lowercase, hyphenated). */
function fallbackSlug(value: string): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function categoryToSlug(category: string): string {
  return CATEGORY_TO_SLUG[category] ?? fallbackSlug(category);
}

export function slugToCategory(slug: string): string {
  const decoded = decodeURIComponent(slug || "");
  if (SLUG_TO_CATEGORY[decoded]) return SLUG_TO_CATEGORY[decoded];
  // Try a case-insensitive match before falling back to the raw value.
  const key = Object.keys(SLUG_TO_CATEGORY).find(
    (candidate) => candidate.toLowerCase() === decoded.toLowerCase(),
  );
  return key ? SLUG_TO_CATEGORY[key] : decoded;
}
