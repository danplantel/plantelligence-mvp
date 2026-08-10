import { PRIMARY_SERVICE_CATEGORY_OPTIONS } from "./service-categories";

export type CategoryPortalVisibility = Record<string, boolean>;

export const DEFAULT_CATEGORY_PORTAL_VISIBILITY: CategoryPortalVisibility =
  PRIMARY_SERVICE_CATEGORY_OPTIONS.reduce((acc, cat) => {
    acc[cat] = true;
    return acc;
  }, {} as CategoryPortalVisibility);

/** All-hidden portal visibility — default for newly created plans so advisors explicitly publish benefit hubs. */
export const HIDDEN_CATEGORY_PORTAL_VISIBILITY: CategoryPortalVisibility =
  PRIMARY_SERVICE_CATEGORY_OPTIONS.reduce((acc, cat) => {
    acc[cat] = false;
    return acc;
  }, {} as CategoryPortalVisibility);

/** Canonical visibility keys (must match Edit Panel and PRIMARY_SERVICE_CATEGORY_OPTIONS) */
const VISIBILITY_KEYS_READONLY = [
  "Retirement",
  "Group Life",
  "Group Health",
  "Other",
] as const;

/** Alternative key names that may appear in stored JSON (e.g. different casing, no space) */
const VISIBILITY_KEY_ALIASES: Record<string, string> = {
  retirement: "Retirement",
  "group life": "Group Life",
  grouplife: "Group Life",
  group_life: "Group Life",
  "group health": "Group Health",
  grouphealth: "Group Health",
  group_health: "Group Health",
  other: "Other",
};

function readVisibilityValue(
  obj: Record<string, unknown>,
  canonicalKey: string,
): boolean {
  let v = obj[canonicalKey];
  if (v === false || v === "false" || v === 0) return false;
  if (v === true || v === "true" || v === 1) return true;
  // Try lowercase key (e.g. from DB/API)
  const lowerKey = canonicalKey.toLowerCase();
  v = obj[lowerKey];
  if (v === false || v === "false" || v === 0) return false;
  if (v === true || v === "true" || v === 1) return true;
  // Try aliases (e.g. "GroupHealth" without space, "group_health")
  for (const [alias, canonical] of Object.entries(VISIBILITY_KEY_ALIASES)) {
    if (canonical !== canonicalKey) continue;
    const vv = obj[alias];
    if (vv === undefined) continue;
    if (vv === false || vv === "false" || vv === 0) return false;
    if (vv === true || vv === "true" || vv === 1) return true;
  }
  // Missing or invalid: treat as visible (safe default)
  return true;
}

/**
 * Normalize raw visibility from API/DB to a full object with exactly the 4 canonical keys.
 * - Handles null/undefined → default (all visible).
 * - Handles broken JSON string → default.
 * - Handles incomplete or wrong-case keys → fills missing with true.
 * - Only explicit false / "false" / 0 are treated as hidden.
 */
export function getCategoryPortalVisibility(
  raw: unknown,
): CategoryPortalVisibility {
  let obj: Record<string, unknown> | null = null;
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return { ...DEFAULT_CATEGORY_PORTAL_VISIBILITY };
    try {
      const parsed = JSON.parse(s) as Record<string, unknown>;
      if (
        parsed != null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        obj = parsed;
      }
    } catch {
      // Broken JSON → default all visible
      return { ...DEFAULT_CATEGORY_PORTAL_VISIBILITY };
    }
  }
  if (!obj) return { ...DEFAULT_CATEGORY_PORTAL_VISIBILITY };
  return PRIMARY_SERVICE_CATEGORY_OPTIONS.reduce((acc, cat) => {
    acc[cat] = readVisibilityValue(obj!, cat);
    return acc;
  }, {} as CategoryPortalVisibility);
}

/** Map benefit card category/title (from Step 5 / defaultBenefits) to Edit Panel visibility key */
function benefitCategoryToVisibilityKey(category: string): keyof CategoryPortalVisibility {
  const c = (category || "").trim().toLowerCase();
  if (c === "retirement" || c === "retirement plan benefits") return "Retirement";
  if (c === "group health" || c === "health insurance") return "Group Health";
  if (c === "group life" || c === "life insurance") return "Group Life";
  if (
    c === "other" ||
    c === "other benefits" ||
    c === "company / plan sponsor" ||
    c === "wellness programs" ||
    c === "recordkeeper / vendor"
  )
    return "Other";
  return "Other";
}

/**
 * When restoring a category via Edit Panel (visibility set to true), sync benefits
 * so isEnabled is true for benefits in that category. Otherwise they stay hidden
 * because PortalBenefits filters by both category visibility AND benefit.isEnabled.
 */
export function syncBenefitsWithCategoryVisibility<T extends { category?: string; title?: string; isEnabled?: boolean }>(
  benefits: T[] | null | undefined,
  visibility: CategoryPortalVisibility | null | undefined,
): T[] {
  if (!Array.isArray(benefits) || !visibility) return benefits ?? [];
  return benefits.map((b) => {
    const category = (b.category || b.title || "") as string;
    const key = benefitCategoryToVisibilityKey(category);
    const isVisible = visibility[key] !== false;
    if (isVisible && b.isEnabled === false) {
      return { ...b, isEnabled: true };
    }
    return b;
  });
}

/**
 * Visibility is expected to come from getCategoryPortalVisibility (always has 4 keys).
 * If visibility is null/undefined, we treat as "no filter" → show (return true).
 * Maps benefit card labels (e.g. "Retirement Plan Benefits", "Health Insurance") to the 4 keys.
 */
export function isCategoryVisibleInPortal(
  category: string,
  visibility: CategoryPortalVisibility | null | undefined,
): boolean {
  if (!visibility || typeof visibility !== "object") return true;
  const key = benefitCategoryToVisibilityKey(category);
  return visibility[key] !== false;
}

/** Map contact benefitsCategories (wizard/UI names) to Edit Panel visibility keys (Retirement, Group Life, Group Health, Other) */
const CONTACT_CATEGORY_TO_VISIBILITY_KEY: Record<string, string> = {
  // Retirement (including wizard label "Retirement Plan Benefits")
  Retirement: "Retirement",
  retirement: "Retirement",
  "Retirement Plan Benefits": "Retirement",
  "retirement plan benefits": "Retirement",
  "Retirement Plan": "Retirement",
  "retirement plan": "Retirement",
  // Group Health (edit panel "Group Health")
  "Group Health": "Group Health",
  "group health": "Group Health",
  "Health Insurance": "Group Health",
  "health insurance": "Group Health",
  // Group Life (edit panel "Group Life")
  "Group Life": "Group Life",
  "group life": "Group Life",
  "Life Insurance": "Group Life",
  "life insurance": "Group Life",
  Life: "Group Life",
  life: "Group Life",
  // Other (edit panel "Other") — all non-retirement, non-health, non-life
  Other: "Other",
  "Other Benefits": "Other",
  "other benefits": "Other",
  "Company / Plan Sponsor": "Other",
  "company / plan sponsor": "Other",
  "Wellness Programs": "Other",
  "wellness programs": "Other",
  "Recordkeeper / Vendor": "Other",
  "recordkeeper / vendor": "Other",
};

/** Visibility keys in Edit Panel (must match PRIMARY_SERVICE_CATEGORY_OPTIONS) */
const VISIBILITY_KEYS = VISIBILITY_KEYS_READONLY;

function categoryToVisibilityKey(cat: string): string {
  const trimmed = (cat || "").trim();
  const mapped = CONTACT_CATEGORY_TO_VISIBILITY_KEY[trimmed];
  if (mapped) return mapped;
  if (VISIBILITY_KEYS.includes(trimmed as any)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (
    lower === "retirement" ||
    lower === "retirement plan benefits" ||
    lower === "retirement plan"
  )
    return "Retirement";
  if (lower === "group health" || lower === "health insurance")
    return "Group Health";
  if (lower === "group life" || lower === "life insurance" || lower === "life")
    return "Group Life";
  if (
    lower === "other" ||
    lower === "other benefits" ||
    lower === "company / plan sponsor" ||
    lower === "wellness programs" ||
    lower === "recordkeeper / vendor"
  )
    return "Other";
  // Any unknown contact category → treat as Other (hide when user hides "Other" in edit panel)
  return "Other";
}

/** True when every portal category (Retirement, Group Life, Group Health, Other) is hidden */
export function areAllCategoriesHiddenInPortal(
  visibility: CategoryPortalVisibility | null | undefined,
): boolean {
  if (!visibility || typeof visibility !== "object") return false;
  return VISIBILITY_KEYS.every((key) => visibility[key] === false);
}

/**
 * Business rules:
 * - If visibility is missing/invalid → show contact (no filter).
 * - If all 4 categories are hidden (the default state for newly created plans) →
 *   still show every contact. Key contacts must display even when all benefit hubs
 *   are hidden; the category toggles only hide contacts for a specific category when
 *   at least one other category remains visible.
 * - If contact has no categories → show only when all 4 categories are visible; else hide.
 * - If contact has at least one category → show iff that category (or any of them) is visible.
 * Visibility should come from getCategoryPortalVisibility so keys are always the 4 canonical ones.
 */
export function isContactVisibleInPortal(
  benefitsCategories: string[] | undefined | null,
  visibility: CategoryPortalVisibility | null | undefined,
): boolean {
  if (!visibility || typeof visibility !== "object") return true;
  // Contacts display even when every hub is hidden (default for new plans); the
  // per-category Hide toggles only suppress contacts in that category when at
  // least one other category is still visible.
  if (areAllCategoriesHiddenInPortal(visibility)) return true;
  const cats = Array.isArray(benefitsCategories) ? benefitsCategories : [];
  if (cats.length === 0) {
    return VISIBILITY_KEYS.every((key) => visibility[key] !== false);
  }
  return cats.some((cat) => {
    const key = categoryToVisibilityKey(String(cat));
    return visibility[key] !== false;
  });
}

const KNOWN_CATEGORIES_FOR_CONTACT = [
  "Retirement",
  "Retirement Plan Benefits",
  "Retirement Plan",
  "Group Life",
  "Group Health",
  "Other",
  "Life Insurance",
  "Health Insurance",
  "Other Benefits",
  "Company / Plan Sponsor",
  "Wellness Programs",
  "Recordkeeper / Vendor",
];

function collectCategoryStringsFromObj(obj: unknown, depth: number): string[] {
  if (depth > 3 || obj == null) return [];
  if (typeof obj === "string") {
    const t = (obj as string).trim();
    if (!t) return [];
    const exactMatch = KNOWN_CATEGORIES_FOR_CONTACT.find(
      (k) => k.toLowerCase() === t.toLowerCase()
    );
    return exactMatch ? [exactMatch] : [];
  }
  if (Array.isArray(obj))
    return obj.flatMap((v) => collectCategoryStringsFromObj(v, depth + 1));
  if (typeof obj === "object")
    return Object.values(obj as object).flatMap((v: unknown) =>
      collectCategoryStringsFromObj(v, depth + 1)
    );
  return [];
}

/**
 * Extract benefit category strings from a contact (benefitsCategories, benefitsCategory, category, etc.)
 * and normalize to visibility keys (Retirement, Group Life, Group Health, Other).
 */
export function getContactCategories(contact: Record<string, unknown> | null | undefined): string[] {
  if (!contact || typeof contact !== "object") return [];
  const fromArray = Array.isArray(contact.benefitsCategories)
    ? (contact.benefitsCategories as string[])
    : [];
  const fromSingle =
    contact.benefitsCategory != null && contact.benefitsCategory !== ""
      ? [String(contact.benefitsCategory)]
      : [];
  const fromCategory =
    contact.category != null && contact.category !== ""
      ? [String(contact.category)]
      : [];
  const fromSnake =
    contact.benefits_category != null && contact.benefits_category !== ""
      ? [String(contact.benefits_category)]
      : [];
  const benefits = contact.benefits as Record<string, unknown> | null | undefined;
  const fromNested =
    benefits && typeof benefits === "object" && benefits.category != null
      ? [String(benefits.category)]
      : [];
  let combined = [
    ...fromArray,
    ...fromSingle,
    ...fromCategory,
    ...fromSnake,
    ...fromNested,
  ]
    .filter(Boolean)
    .map((x) => String(x).trim());
  if (combined.length === 0) {
    combined = collectCategoryStringsFromObj(contact, 0);
  }
  const normalized = combined.map((cat) => {
    const lower = cat.toLowerCase();
    if (
      lower === "retirement" ||
      lower === "retirement plan benefits" ||
      lower === "retirement plan"
    )
      return "Retirement";
    if (lower === "health insurance") return "Group Health";
    if (lower === "life insurance" || lower === "life") return "Group Life";
    if (
      lower === "other benefits" ||
      lower === "company / plan sponsor" ||
      lower === "wellness programs" ||
      lower === "recordkeeper / vendor"
    )
      return "Other";
    return cat;
  });
  return Array.from(new Set(normalized));
}

/**
 * Filter contacts by category portal visibility (same logic as My Benefits Team).
 * Use on the main portal page so keyContacts passed to ClientPortal only include contacts whose category is visible.
 */
export function filterContactsByPortalVisibility(
  contacts: Record<string, unknown>[],
  visibility: CategoryPortalVisibility | null | undefined
): Record<string, unknown>[] {
  const normalizedVisibility = getCategoryPortalVisibility(visibility);
  return contacts.filter((c) =>
    isContactVisibleInPortal(getContactCategories(c), normalizedVisibility)
  );
}
