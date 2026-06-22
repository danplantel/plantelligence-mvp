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
