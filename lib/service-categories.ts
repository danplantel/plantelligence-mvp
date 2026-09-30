import { ServiceType } from "@/types/wizard";

/**
 * Single source of truth for primary service category labels.
 * Used in Step 2 (onboarding), Settings, and User.primaryServiceCategories.
 */
export const PRIMARY_SERVICE_CATEGORY_OPTIONS = [
  "Retirement",
  "Group Life",
  "Group Health",
  "Other",
] as const;

export type PrimaryServiceCategory = (typeof PRIMARY_SERVICE_CATEGORY_OPTIONS)[number];

/** Map category label -> Step 2 / WizardServices enum value */
const CATEGORY_TO_STEP2: Record<string, string> = {
  Retirement: ServiceType.RETIREMENT,
  "Group Life": ServiceType.GROUP_LIFE_DISABILITY,
  "Group Health": ServiceType.GROUP_HEALTH,
  Other: ServiceType.OTHER,
};

/** Map Step 2 enum value -> category label (supplemental_health -> Other) */
const STEP2_TO_CATEGORY: Record<string, string> = {
  [ServiceType.RETIREMENT]: "Retirement",
  [ServiceType.GROUP_LIFE_DISABILITY]: "Group Life",
  [ServiceType.GROUP_HEALTH]: "Group Health",
  [ServiceType.SUPPLEMENTAL_HEALTH]: "Other",
  [ServiceType.OTHER]: "Other",
};

export function categoryToStep2ServiceType(category: string): string {
  return CATEGORY_TO_STEP2[category] ?? category;
}

export function step2ServiceTypeToCategory(step2Value: string): string {
  return STEP2_TO_CATEGORY[step2Value] ?? step2Value;
}

/** Convert selected category labels to Step 2 services array (for WizardServices API) */
export function categoriesToStep2Services(categories: string[]): string[] {
  const seen = new Set<string>();
  return categories
    .map((c) => categoryToStep2ServiceType(c))
    .filter((v) => v && !seen.has(v) && seen.add(v));
}

/** Convert Step 2 services array to category labels (for display) */
export function step2ServicesToCategories(step2Services: string[]): string[] {
  const seen = new Set<string>();
  return step2Services
    .map((v) => step2ServiceTypeToCategory(v))
    .filter((c) => PRIMARY_SERVICE_CATEGORY_OPTIONS.includes(c as PrimaryServiceCategory) && !seen.has(c) && seen.add(c));
}

/** Display label for document/benefits category (e.g. in Step 4 uploaded docs). Matches Settings names. */
export function getDocumentCategoryDisplayLabel(category: string): string {
  if (category === "Other Benefits") return "Other";
  if (category && category.includes(",")) return "Multiple";
  return category || "";
}

/**
 * Stored service-category labels → the labels Browse Benefits' "Your organization offers"
 * strip renders: trimmed, de-duped, and presented in the canonical order above, so the chip
 * order cannot drift with whatever order the record happens to hold.
 *
 * Unknown-but-stored labels are KEPT, not dropped — the stored value is what the
 * organization actually offers, so hiding one would understate the list.
 *
 * This lives in a plain module rather than in the strip's component because the Benefits
 * page resolves it while rendering on the SERVER, and a `"use client"` module's exports are
 * client references that cannot be called there.
 */
export function normalizePrimaryServiceCategories(values: unknown): string[] {
  const labels = (Array.isArray(values) ? values : [])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  const canonicalIndex = (label: string) =>
    PRIMARY_SERVICE_CATEGORY_OPTIONS.indexOf(label as PrimaryServiceCategory);

  return Array.from(new Set(labels)).sort((a, b) => {
    const ai = canonicalIndex(a);
    const bi = canonicalIndex(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
