/**
 * Document categories for persistence and Hub ordering.
 * Aligns with BenefitsCategory (Step 4) and portal visibility in
 * lib/portal-category-visibility.ts (benefitCategoryToVisibilityKey).
 *
 * AI hints use Prisma fields categorySuggested / categoryConfidence (same intent as
 * aiSuggestedCategory / aiConfidence in the 3b.2 spec).
 */

/** Hub sort: Retirement → Group Health → Group Life → other benefit tabs (matches portal card order). */
export const DOCUMENT_CATEGORY_HUB_SORT_ORDER = [
  "Retirement",
  "Group Health",
  "Group Life",
  "Other Benefits",
  "Company / Plan Sponsor",
  "Recordkeeper / Vendor",
] as const;

const SORT_INDEX: Record<string, number> = Object.fromEntries(
  DOCUMENT_CATEGORY_HUB_SORT_ORDER.map((c, i) => [c, i]),
);

function normalizeCategoryForSort(category: string): string {
  const c = (category || "").trim();
  if (!c) return "Other Benefits";
  if (c === "Other") return "Other Benefits";
  if (c === "General") return "Other Benefits";
  return c;
}

/**
 * Map R2 upload slugs (lib/r2 toCanonicalCategory) and other variants to hub labels.
 * R2 often persists "retirement" / "group-health" while the portal matches "Retirement" / "Group Health".
 */
function normalizeExplicitCategoryToHub(raw: string): string {
  const trimmed = String(raw).trim();
  if (!trimmed) return "Other Benefits";
  if (trimmed === "General") return "Other Benefits";

  const k = trimmed.toLowerCase().replace(/_/g, "-").replace(/\s+/g, " ").trim();

  if (
    k === "company / plan sponsor" ||
    k === "wellness" ||
    k === "wellness programs"
  ) {
    return "Company / Plan Sponsor";
  }
  if (k === "recordkeeper" || k === "recordkeeper / vendor") {
    return "Recordkeeper / Vendor";
  }
  if (k === "retirement plan benefits" || k === "retirement plan") {
    return "Retirement";
  }
  if (k === "health insurance") {
    return "Group Health";
  }
  if (k === "life insurance") {
    return "Group Life";
  }

  const slugToHub: Record<
    string,
    (typeof DOCUMENT_CATEGORY_HUB_SORT_ORDER)[number]
  > = {
    retirement: "Retirement",
    "group-health": "Group Health",
    "group health": "Group Health",
    "group-life": "Group Life",
    "group life": "Group Life",
    grouplife: "Group Life",
    other: "Other Benefits",
    "other benefits": "Other Benefits",
  };

  if (slugToHub[k]) return slugToHub[k];

  const inHub = DOCUMENT_CATEGORY_HUB_SORT_ORDER.find(
    (h) => h.toLowerCase() === k,
  );
  if (inHub) return inHub;

  return trimmed;
}

/**
 * Always returns a non-empty category string suitable for portal filtering
 * (isCategoryVisibleInPortal) and completeness checks.
 *
 * When `explicitCategory` is empty, an R2 `storageKey` may still encode the
 * plan-document segment (`.../documents/retirement/...`) from upload — use that
 * so plan docs are not misclassified as "Other Benefits" when the DB row
 * missed the category field.
 */
export function resolvePersistedDocumentCategory(
  documentType: string | null | undefined,
  explicitCategory: string | null | undefined,
  storageKey?: string | null,
): string {
  const trimmed =
    explicitCategory != null && String(explicitCategory).trim() !== ""
      ? String(explicitCategory).trim()
      : "";
  if (trimmed) {
    return normalizeExplicitCategoryToHub(trimmed);
  }
  const t = (documentType || "Document").toUpperCase();
  if (t === "SPD") return "Retirement";
  if (t === "SBC") return "Group Health";

  const k = (storageKey && String(storageKey).trim()) || "";
  if (k) {
    const m = k.match(/\/documents\/(retirement|group-health|group-life|other)(?:\/|$)/i);
    if (m) {
      const seg = m[1].toLowerCase();
      if (seg === "retirement") return "Retirement";
      if (seg === "group-health") return "Group Health";
      if (seg === "group-life") return "Group Life";
      if (seg === "other") return "Other Benefits";
    }
  }

  return "Other Benefits";
}

/** Sort key for Benefits Hub / portal document lists (lower = earlier). */
export function compareDocumentCategoriesHubOrder(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const na = normalizeCategoryForSort(String(a ?? ""));
  const nb = normalizeCategoryForSort(String(b ?? ""));
  const ia = SORT_INDEX[na] ?? 100;
  const ib = SORT_INDEX[nb] ?? 100;
  if (ia !== ib) return ia - ib;
  return na.localeCompare(nb);
}
