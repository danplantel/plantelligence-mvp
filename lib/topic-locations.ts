import {
  CUSTOM_BENEFIT_CATEGORY,
  isCustomHubCategory,
} from "@/lib/benefit-custom-name";
import type { TopicLocation } from "@/types/topic";

/**
 * The one place that maps a `Benefit.category` STRING to a `TopicLocation`, and back.
 *
 * This is the lossy seam in the topic framework. A placement is stored against an
 * enum, but a Benefit row stores free text:
 *
 *   "Retirement" | "Group Health" | "Group Life" | "Company / Plan Sponsor"
 *
 * and the fourth hub's *display* name is the advisor's own (`Benefit.title`), not the
 * category. Every caller that needs to go from a hub page to its placements — or from
 * a category to the location it seeds — must come through here, so the two directions
 * can never disagree.
 *
 * Rules:
 *  - The canonical order is fixed: Retirement, Group Health, Group Life, Other/Custom.
 *  - `employee_resources` is reserved for TF-6 and has NO Benefit category, so the
 *    mapping returns null for it in both directions. It is never inferred from a name.
 *  - A free-text spelling we do not recognise is treated as the Custom hub, because a
 *    Benefit row always IS one of the four hubs and the Custom one is the only slot
 *    whose stored category has changed spelling over the app's life
 *    ("Custom", "Others", "Wellness Programs", …).
 */

/** The four benefit-category hubs, in canonical order. Employee Resources is not one. */
export const TOPIC_LOCATION_ORDER: readonly TopicLocation[] = [
  "retirement",
  "group_health",
  "group_life",
  "custom",
] as const;

/** Display labels for the admin builder and any headings. */
export const TOPIC_LOCATION_LABELS: Record<TopicLocation, string> = {
  retirement: "Retirement",
  group_health: "Group Health",
  group_life: "Group Life",
  custom: "Other / Custom",
  // Reserved (TF-6) — no Benefit category exists for this location yet.
  employee_resources: "Employee Resources",
};

/**
 * The `Benefit.category` value each location is stored under.
 *
 * The Custom hub keeps the app's existing storage key (`"Company / Plan Sponsor"`);
 * renaming it here would orphan every row already saved with that value.
 */
export const TOPIC_LOCATION_CATEGORY: Record<TopicLocation, string | null> = {
  retirement: "Retirement",
  group_health: "Group Health",
  group_life: "Group Life",
  custom: CUSTOM_BENEFIT_CATEGORY,
  employee_resources: null,
};

/** Type guard for values arriving from a query string or stored JSON. */
export function isTopicLocation(value: unknown): value is TopicLocation {
  if (typeof value !== "string") return false;
  return (
    value === "employee_resources" ||
    (TOPIC_LOCATION_ORDER as readonly string[]).includes(value)
  );
}

/**
 * Spellings that have meant each hub. Matched case-insensitively with punctuation
 * flattened, so "GroupHealth", "group_health" and "GROUP HEALTH" are one location.
 */
const CATEGORY_ALIASES: Record<string, TopicLocation> = {
  retirement: "retirement",
  "retirement plan benefits": "retirement",
  "retirement benefits": "retirement",

  "group health": "group_health",
  // Compact spellings the app already accepts elsewhere (see
  // `lib/portal-category-visibility.ts`'s visibility-key aliases).
  grouphealth: "group_health",
  health: "group_health",
  "health insurance": "group_health",
  healthinsurance: "group_health",
  "health benefits": "group_health",

  "group life": "group_life",
  grouplife: "group_life",
  "group life insurance": "group_life",
  life: "group_life",
  "life insurance": "group_life",
  lifeinsurance: "group_life",
  "life insurance benefits": "group_life",
  "group life disability": "group_life",

  custom: "custom",
  other: "custom",
  "other custom": "custom",
  "company plan sponsor": "custom",
  "wellness programs": "custom",
  wellness: "custom",
  "voluntary benefits": "custom",
};

/** `"Group / Health"`, `"group_health"`, `" Group Health "` → `"group health"`. */
function normalizeCategoryKey(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Which location does this `Benefit.category` belong to?
 *
 * Returns `null` for an empty value (nothing is known yet) and for the reserved
 * Employee Resources hub, which is not a benefit category. Callers must treat `null`
 * as "this hub has no placements" rather than falling back to another location.
 */
export function topicLocationForCategory(
  category: string | null | undefined,
): TopicLocation | null {
  const raw = (category || "").trim();
  if (!raw) return null;

  // Employee Resources is its own hub and must never be inferred from free text.
  if (normalizeCategoryKey(raw) === "employee resources") return null;

  // The Custom hub accepts every spelling already in the codebase.
  if (isCustomHubCategory(raw)) return "custom";

  const key = normalizeCategoryKey(raw);
  const known = CATEGORY_ALIASES[key];
  if (known) return known;

  // An unrecognised non-empty category on a Benefit row is the Custom hub's old
  // storage spelling. Mapping it anywhere else would attach a plan's topics to the
  // wrong hub, which is worse than widening the Custom hub.
  return "custom";
}

/**
 * The `Benefit.category` a location is stored under, or `null` when the location is
 * not a benefit category (Employee Resources).
 */
export function benefitCategoryForLocation(
  location: TopicLocation,
): string | null {
  return TOPIC_LOCATION_CATEGORY[location] ?? null;
}

/**
 * The category label a location's PERMISSION check uses (TF-6).
 *
 * This is deliberately NOT `benefitCategoryForLocation`: Employee Resources has no
 * Benefit row, but it still needs an assignment scope of its own so an HR collaborator
 * can be granted this location and nothing else. A teammate assignment stores free
 * text categories, so the label is what makes "edit rights on Employee Resources only"
 * enforceable. It is spaced (not `employee_resources`) because the assignment model
 * compares normalized, human-readable category names.
 */
export function topicLocationAccessCategory(location: TopicLocation): string {
  if (location === "employee_resources") return "Employee Resources";
  return benefitCategoryForLocation(location) ?? "";
}

/**
 * The label to show for a location. The Custom hub shows the advisor's own benefit
 * name when there is one, exactly like the portal heading does.
 */
export function topicLocationLabel(
  location: TopicLocation,
  customName?: string | null,
): string {
  if (location === "custom") {
    const name = (customName || "").trim();
    return name || TOPIC_LOCATION_LABELS.custom;
  }
  return TOPIC_LOCATION_LABELS[location];
}

/** True for the four hubs that are benefit categories (i.e. everything but HR). */
export function isBenefitCategoryLocation(
  location: TopicLocation,
): boolean {
  return (TOPIC_LOCATION_ORDER as readonly string[]).includes(location);
}
