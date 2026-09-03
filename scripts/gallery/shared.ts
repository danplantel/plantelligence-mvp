/**
 * Shared constants/helpers for the Default Image Library scripts.
 * Imported by sync-default-gallery.ts and validate-gallery.ts.
 */

/** Facets the quality gates require to be present and non-empty on every image. */
export const REQUIRED_FACETS = [
  "benefitCategories",
  "industries",
  "environments",
  "subjects",
  "themes",
  "useCases",
  "visualStyles",
  "tone",
  "composition",
] as const;

/** Facet keys written to the optional controlled-vocabulary file. */
export const VOCAB_FACETS = [
  ...REQUIRED_FACETS,
  "lifeStages",
] as const;

export type FacetName = (typeof REQUIRED_FACETS)[number];

/** Coerce an unknown manifest value into a string array (non-string items dropped). */
export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
