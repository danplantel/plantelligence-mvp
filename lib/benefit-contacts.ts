/**
 * benefit-contacts — the single resolver for "who is attached to this benefit".
 *
 * Why this module exists: the same contacts have to appear in two places —
 * **My Benefits Team** and the **category's own page** (Retirement, Group Health,
 * Group Life, Custom) — and a provider/recordkeeper has to sit beside the
 * account-access block. If each surface did its own filtering, contact or
 * provider data could bleed across plans or across categories.
 *
 * So every read goes through here, and every function is keyed on a plan's
 * contact list (`Client.keyContacts`) plus a single category. Nothing global is
 * ever read, and `Benefit.supportContacts` entries whose `contactId` is no longer
 * in the plan's contact list are dropped — which is what keeps a deleted contact
 * (or a stale draft) from resurfacing anywhere.
 *
 * Pure functions only — no fetching, no React — so they are trivially testable.
 */

import type { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";
import type { SupportContact } from "@/types/benefit";
import {
  getContactCategories as getVisibilityCategories,
  isContactVisibleInPortal,
  type CategoryPortalVisibility,
} from "@/lib/portal-category-visibility";

/** Benefit categories as the wizard/UI spells them (includes "Custom"). */
export type ContactCategory = string;

/**
 * Normalize a category for comparison: case/whitespace-insensitive, and the
 * "Custom" hub (wizard label) is the same thing as "Company / Plan Sponsor"
 * (the stored label). Mirrors the mapping in lib/save-benefit.
 */
export function normalizeContactCategory(
  category: string | null | undefined,
): string {
  const c = (category || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (c === "custom") return "company / plan sponsor";
  if (c === "health insurance") return "group health";
  if (c === "life insurance") return "group life";
  return c;
}

/** Every category a contact is attached to (array form wins over the legacy single field). */
export function contactCategories(contact: KeyContact | null | undefined): string[] {
  if (!contact) return [];
  const list = Array.isArray(contact.benefitsCategories)
    ? contact.benefitsCategories.filter(Boolean)
    : [];
  if (list.length > 0) return list as string[];
  return contact.benefitsCategory ? [contact.benefitsCategory as string] : [];
}

/** Does this contact belong to that benefit category? */
export function contactServesCategory(
  contact: KeyContact | null | undefined,
  category: string,
): boolean {
  const target = normalizeContactCategory(category);
  if (!target) return false;
  return contactCategories(contact).some(
    (c) => normalizeContactCategory(c) === target,
  );
}

/**
 * Is this contact the *category's* primary? Prefers the explicit per-category
 * flags; falls back to the legacy `isPrimary` only when the contact serves that
 * one category, so a plan-wide primary can't claim every category's card.
 */
export function isCategoryPrimaryContact(
  contact: KeyContact | null | undefined,
  category: string,
): boolean {
  if (!contact || !contactServesCategory(contact, category)) return false;
  const target = normalizeContactCategory(category);

  const byCategory = contact.isPrimaryByCategory as
    | Record<string, boolean>
    | undefined;
  if (byCategory) {
    const hit = Object.entries(byCategory).some(
      ([cat, isPrimary]) =>
        isPrimary === true && normalizeContactCategory(cat) === target,
    );
    if (hit) return true;
  }
  if (contact.isPrimaryForCategory) return true;

  if (contact.isPrimary || contact.isPrimaryOverall) {
    // Legacy flag with no per-category precision: only trust it when this
    // contact is attached to this single category.
    return contactCategories(contact).length <= 1;
  }
  return false;
}

/** A resolved contact plus the per-benefit copy the advisor configured for it. */
export interface ResolvedCategoryContact {
  contact: KeyContact;
  /** Per-category override from `Benefit.supportContacts`. */
  title?: string;
  description?: string;
  isPrimaryForCategory: boolean;
}

export interface ResolvedCategoryContacts {
  /** The category's primary contact, if one is configured. */
  primary: ResolvedCategoryContact | null;
  /** Additional (optional) contacts for this category, primary excluded. */
  others: ResolvedCategoryContact[];
  /** Primary first, then `others` — convenient for rendering one row. */
  team: ResolvedCategoryContact[];
}

/**
 * Contacts for ONE benefit category.
 *
 * `keyContacts` must be the contacts of the plan that owns `benefit` — passing
 * another plan's list here is the only way to bleed data, and the `contactId`
 * lookup below makes that impossible to do accidentally: an entry that is not in
 * the supplied list is dropped rather than rendered.
 */
export function resolveCategoryContacts({
  keyContacts,
  category,
  supportContacts,
  primaryContactId,
}: {
  keyContacts: KeyContact[] | null | undefined;
  /** The benefit's category, e.g. "Retirement" | "Company / Plan Sponsor". */
  category: string;
  /** The Benefit row's `supportContacts` JSON. */
  supportContacts?: SupportContact[] | null;
  /** Optional explicit primary (the wizard's step-1 `contactId` for this category). */
  primaryContactId?: string | null;
}): ResolvedCategoryContacts {
  const byId = new Map<string, KeyContact>();
  (keyContacts || []).forEach((c) => {
    if (c?.id) byId.set(c.id, c);
  });

  const resolved: ResolvedCategoryContact[] = [];
  const seen = new Set<string>();

  for (const entry of supportContacts || []) {
    if (!entry || entry.enabled === false) continue;
    const contact = byId.get(String(entry.contactId || ""));
    // Orphaned entry (contact deleted, or from another plan's draft) — drop it.
    if (!contact) continue;
    if (seen.has(contact.id)) continue;
    // `isPrimary` on the entry means the advisor attached this contact to THIS
    // category's row as its primary (see lib/save-benefit), so the entry is
    // authoritative for membership even when the contact's own category tags lag
    // behind. It still cannot bleed: the entry exists inside this one category's
    // `Benefit.supportContacts` and nowhere else.
    const entryMarksPrimary = entry.isPrimary === true;
    if (
      !entryMarksPrimary &&
      !contactServesCategory(contact, category) &&
      contact.id !== primaryContactId
    ) {
      continue;
    }
    seen.add(contact.id);
    resolved.push({
      contact,
      title: entry.title,
      description: entry.description,
      isPrimaryForCategory:
        entryMarksPrimary || isCategoryPrimaryContact(contact, category),
    });
  }

  // The explicitly-selected primary may not be in `supportContacts` yet
  // (step 1 selects it before step 3 toggles the list) — add it if the plan owns it.
  if (primaryContactId && !seen.has(primaryContactId)) {
    const contact = byId.get(primaryContactId);
    if (contact) {
      resolved.push({
        contact,
        isPrimaryForCategory: true,
      });
    }
  }

  const primary =
    resolved.find((r) => r.isPrimaryForCategory) ??
    resolved.find((r) => r.contact.id === primaryContactId) ??
    null;
  const others = resolved.filter((r) => r !== primary);

  return {
    primary,
    others,
    team: primary ? [primary, ...others] : others,
  };
}

export interface ResolvedTeamContact {
  contact: KeyContact;
  /** Every category this contact serves (labels as stored). */
  categories: string[];
  /** The categories this contact is primary for. */
  primaryFor: string[];
  isPrimary: boolean;
}

/**
 * My Benefits Team — the plan-wide list, with each contact annotated with the
 * categories they serve so the card can show "Retirement · Group Health".
 *
 * A contact appears once even when attached to several categories. Ordering is
 * adapter-friendly: overall primary first, then category primaries, then the rest
 * (stable by name).
 */
export function resolveTeamContacts({
  keyContacts,
  visibility,
  categories,
}: {
  keyContacts: KeyContact[] | null | undefined;
  /** Per-category Show/Hide from `Client.categoryPortalVisibility`. */
  visibility?: CategoryPortalVisibility | null;
  /**
   * The categories to consider. Pass the plan's benefit categories so a contact
   * attached to a hidden/removed category is not listed.
   */
  categories?: string[] | null;
}): ResolvedTeamContact[] {
  const allowed = (categories || [])
    .map((c) => normalizeContactCategory(c))
    .filter(Boolean);

  const rows: ResolvedTeamContact[] = [];

  for (const contact of keyContacts || []) {
    if (!contact?.id) continue;
    if (contact.showOnPortal === false) continue;

    const served = contactCategories(contact);
    const relevant = served.filter(
      (c) => allowed.length === 0 || allowed.includes(normalizeContactCategory(c)),
    );
    if (served.length > 0 && relevant.length === 0) continue;

    // Same Show/Hide rule My Benefits Team already applies today.
    const visibilityCategories = getVisibilityCategories(
      contact as unknown as Record<string, unknown>,
    );
    if (!isContactVisibleInPortal(visibilityCategories, visibility)) {
      continue;
    }

    const primaryFor = relevant.filter((c) =>
      isCategoryPrimaryContact(contact, c),
    );

    rows.push({
      contact,
      categories: relevant.length > 0 ? relevant : served,
      primaryFor,
      isPrimary: !!contact.isPrimaryOverall || primaryFor.length > 0,
    });
  }

  const nameOf = (c: KeyContact) =>
    `${c.firstName || ""} ${c.lastName || ""}`.trim() ||
    c.name ||
    c.displayName ||
    "";

  return rows.sort((a, b) => {
    const rank = (r: ResolvedTeamContact) =>
      r.contact.isPrimaryOverall ? 0 : r.primaryFor.length > 0 ? 1 : 2;
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return nameOf(a.contact).localeCompare(nameOf(b.contact), undefined, {
      sensitivity: "base",
    });
  });
}

/** Labels used on cards, mapped from the stored category names. */
export function categoryLabel(category: string): string {
  const c = normalizeContactCategory(category);
  if (c === "company / plan sponsor") return "Company / Plan Sponsor";
  if (c === "group health") return "Group Health";
  if (c === "group life") return "Group Life";
  if (c === "retirement") return "Retirement";
  return category;
}

/** The four categories a plan can publish, as the wizard spells them. */
export const BENEFIT_CONTACT_CATEGORIES: BenefitsCategory[] = [
  "Retirement",
  "Group Health",
  "Group Life",
  "Company / Plan Sponsor",
];
