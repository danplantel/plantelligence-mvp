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

/**
 * How many support contacts ONE benefit can show.
 *
 * A benefit page renders its team as a single row of contact cards, which stops
 * being readable past four, so the advisor picks the four employees should write to.
 * Enforced by the editor (Create Benefit step 3 / the Edit Benefit Contacts tab);
 * a benefit that already holds more (selected before the rule existed) is left
 * alone — the editor flags it and lets the advisor reduce it by hand.
 */
export const MAX_SUPPORT_CONTACTS_PER_BENEFIT = 4;

/** May another support contact still be added to a benefit with this many? */
export function canAddSupportContact(selectedCount: number): boolean {
  return selectedCount < MAX_SUPPORT_CONTACTS_PER_BENEFIT;
}

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

/**
 * Canonical order of the contact categories — the order the card badge and the merged
 * `benefitsCategories` list use, so two rows for the same person always produce the same
 * label ("Retirement · Group Health · Group Life") regardless of the order they were added.
 */
const CONTACT_CATEGORY_ORDER = [
  "Retirement",
  "Group Health",
  "Group Life",
  "Other Benefits",
  "Company / Plan Sponsor",
  "Third Party Contact",
] as const;

/** Fold a stored category spelling onto its canonical contact label. */
export function canonicalContactCategory(
  value: string | null | undefined,
): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  switch (normalizeContactCategory(raw)) {
    case "retirement":
      return "Retirement";
    case "group health":
      return "Group Health";
    case "group life":
      return "Group Life";
    case "other":
    case "other benefits":
      return "Other Benefits";
    case "company / plan sponsor":
      return "Company / Plan Sponsor";
    case "third party contact":
      return "Third Party Contact";
    default:
      return raw;
  }
}

function categoryRank(category: string): number {
  const index = CONTACT_CATEGORY_ORDER.indexOf(
    category as (typeof CONTACT_CATEGORY_ORDER)[number],
  );
  return index === -1 ? CONTACT_CATEGORY_ORDER.length : index;
}

/** Union two category lists into canonical order, de-duplicated. */
export function mergeContactCategoryLists(
  a: readonly string[],
  b: readonly string[],
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const value of [...a, ...b]) {
    const canonical = canonicalContactCategory(value);
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(canonical);
  }
  // Stable sort: unknown labels keep their relative order after the known ones.
  return merged
    .map((category, index) => ({ category, index }))
    .sort((x, y) => categoryRank(x.category) - categoryRank(y.category) || x.index - y.index)
    .map((entry) => entry.category);
}

/**
 * The identity two Key Contact rows must share to be the SAME person.
 *
 * Email is the only reliable key (it is what the teammate mirror matches on, so two rows
 * with one email already collapse into one profile). Rows without an email fall back to
 * the contact type + name + phone digits; when that is not distinctive they are left
 * alone rather than guessed at.
 */
function contactPersonKey(contact: KeyContact | null | undefined): string | null {
  if (!contact) return null;
  const email = (contact.email || "").trim().toLowerCase();
  if (email && email.includes("@")) return `email:${email}`;

  const name = (
    contact.name ||
    contact.displayName ||
    `${contact.firstName || ""} ${contact.lastName || ""}`
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const phone = (contact.phone || "").replace(/\D/g, "");
  if (!name || !phone) return null;
  return `person:${contact.contactType || "individual"}|${name}|${phone}`;
}

/** Copy a value from `source` only where `target` has nothing usable. */
function fillBlanks<T extends Record<string, any>>(target: T, source: T): T {
  const out: Record<string, any> = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (value === undefined || value === null) continue;
    const current = out[key];
    const currentBlank =
      current === undefined ||
      current === null ||
      (typeof current === "string" && current.trim() === "") ||
      (Array.isArray(current) && current.length === 0);
    if (currentBlank) out[key] = value;
  }
  return out as T;
}

function mergePrimaryByCategory(
  a: KeyContact["isPrimaryByCategory"],
  b: KeyContact["isPrimaryByCategory"],
): KeyContact["isPrimaryByCategory"] {
  if (!a && !b) return a;
  const merged: Record<string, boolean> = { ...(a as Record<string, boolean>) };
  for (const [category, isPrimary] of Object.entries(
    (b || {}) as Record<string, boolean>,
  )) {
    if (isPrimary === true) merged[category] = true;
  }
  return merged as KeyContact["isPrimaryByCategory"];
}

/** Fold a duplicate person row into the surviving row. */
function mergeContactRows(survivor: KeyContact, duplicate: KeyContact): KeyContact {
  const categories = mergeContactCategoryLists(
    contactCategories(survivor),
    contactCategories(duplicate),
  );
  return fillBlanks(
    {
      ...survivor,
      benefitsCategories: categories as KeyContact["benefitsCategories"],
      // Legacy single field: the first category in canonical order.
      benefitsCategory: (categories[0] as KeyContact["benefitsCategory"]) ?? survivor.benefitsCategory,
      isPrimary: Boolean(survivor.isPrimary || duplicate.isPrimary),
      isPrimaryOverall: Boolean(
        survivor.isPrimaryOverall || duplicate.isPrimaryOverall,
      ),
      isPrimaryForCategory: Boolean(
        survivor.isPrimaryForCategory || duplicate.isPrimaryForCategory,
      ),
      isPrimaryByCategory: mergePrimaryByCategory(
        survivor.isPrimaryByCategory,
        duplicate.isPrimaryByCategory,
      ),
    },
    duplicate,
  );
}

export interface CoalescedKeyContacts {
  /** One row per person, in their original order. */
  contacts: KeyContact[];
  /** Dropped row id → surviving row id, for references that must be re-pointed. */
  idMap: Record<string, string>;
  /** How many duplicate rows were folded away. */
  mergedCount: number;
}

/**
 * Collapse duplicate Key Contact rows for the same person into ONE row.
 *
 * The Create Client form writes a single category per row, so adding the same person under
 * three categories used to store three rows — three cards on the preview and on My Benefits
 * Team. This keeps the earliest row (so a saved drag order still means something), unions
 * the categories in canonical order, ORs the primary flags, and fills the survivor's blanks
 * from the duplicates.
 *
 * `idMap` is the other half of the job: rows are dropped, and the draft / Benefit rows still
 * reference their ids. Callers must remap those references — see `resolveMergedContactId`.
 */
export function coalesceKeyContactsByPerson(
  contacts: KeyContact[] | null | undefined,
): CoalescedKeyContacts {
  const list = Array.isArray(contacts) ? contacts : [];
  const out: KeyContact[] = [];
  const indexByKey = new Map<string, number>();
  const idMap: Record<string, string> = {};

  for (const contact of list) {
    if (!contact || contact.id === undefined || contact.id === null) {
      out.push(contact);
      continue;
    }
    const key = contactPersonKey(contact);
    if (!key) {
      out.push(contact);
      continue;
    }

    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, out.length);
      out.push(contact);
      continue;
    }

    const survivor = out[existingIndex];
    out[existingIndex] = mergeContactRows(survivor, contact);
    const survivorId = String(survivor.id);
    const droppedId = String(contact.id);
    if (droppedId !== survivorId) {
      idMap[droppedId] = survivorId;
      // Any row that already mapped to this dropped id now points at the survivor.
      for (const [oldId, target] of Object.entries(idMap)) {
        if (target === droppedId) idMap[oldId] = survivorId;
      }
    }
  }

  return { contacts: out, idMap, mergedCount: Object.keys(idMap).length };
}

/** Follow an id through a coalescer map. Returns the id unchanged when it is not mapped. */
export function resolveMergedContactId(
  id: string | null | undefined,
  idMap: Record<string, string>,
): string | null {
  if (!id) return null;
  let current = String(id);
  const seen = new Set<string>();
  while (idMap[current] && !seen.has(current)) {
    seen.add(current);
    current = idMap[current];
  }
  return current;
}

/**
 * `Client.keyContacts` is stored either as the contact array or as `{ contacts: [...] }`
 * depending on which save path wrote it, so every reader has to normalize first.
 */
function asContactList(
  keyContacts: KeyContact[] | { contacts?: KeyContact[] } | null | undefined,
): KeyContact[] {
  if (Array.isArray(keyContacts)) return keyContacts;
  const list = (keyContacts as { contacts?: unknown } | null | undefined)
    ?.contacts;
  return Array.isArray(list) ? (list as KeyContact[]) : [];
}

/** Display name for a Key Contact: personal name first, then the team/display name. */
export function contactDisplayName(
  contact: KeyContact | null | undefined,
): string {
  if (!contact) return "";
  const full = [contact.firstName, contact.lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
  if (full) return full;
  const display = (contact.displayName || contact.name || "").trim();
  if (display) return display;
  return (contact.email || "").trim();
}

/**
 * The Key Contact that represents `category` on this plan.
 *
 * This reads the plan's AUTHORED contact list (`Client.keyContacts`) rather than the
 * teammate mirror, so a category can name its contact immediately after Create Client
 * saves — before any benefit row exists and regardless of whether the mirror has run.
 * The explicitly selected primary wins, then the category's primary flag, then any
 * contact attached to the category.
 */
export function keyContactForCategory(
  keyContacts:
    | KeyContact[]
    | { contacts?: KeyContact[] }
    | null
    | undefined,
  category: string | null | undefined,
  options?: { primaryContactId?: string | null },
): KeyContact | null {
  const target = normalizeContactCategory(category);
  if (!target) return null;

  // The Custom hub ("Company / Plan Sponsor") has no Key Contact. Its own storage key is
  // also the contact category for the plan sponsor, so a Main Contact tagged for the plan
  // sponsor resolved here and read as the owner of the advisor's custom benefit. The
  // Custom benefit is named by the advisor and never assumes a contact — the same rule
  // the wizard's own contact prefill applies.
  if (target === "company / plan sponsor") return null;

  const candidates = asContactList(keyContacts).filter(
    (contact) => !!contact && contactServesCategory(contact, target),
  );
  if (candidates.length === 0) return null;

  const selected = options?.primaryContactId
    ? candidates.find((contact) => contact.id === options.primaryContactId)
    : undefined;
  return (
    selected ??
    candidates.find((contact) => isCategoryPrimaryContact(contact, target)) ??
    candidates[0]
  );
}

/**
 * The company logo configured on the plan's Key Contact that serves `category`.
 *
 * Key Contacts are created in Create Client and each can carry its own company logo
 * (the plan sponsor / carrier / recordkeeper the advisor works with). A benefit for
 * that category should start from that partner's logo rather than the advisor's own
 * organization logo or a static hub default, so this resolver mirrors
 * `resolveCategoryContacts`: the explicitly selected primary wins, then the
 * category's primary flag, then any contact attached to the category.
 *
 * Returns "" when no contact for the category has a usable logo. Placeholder assets
 * are ignored so they never get stamped onto a benefit.
 */
export function contactCompanyLogoForCategory(
  keyContacts:
    | KeyContact[]
    | { contacts?: KeyContact[] }
    | null
    | undefined,
  category: string | null | undefined,
  options?: { primaryContactId?: string | null },
): string {
  const target = normalizeContactCategory(category);
  if (!target) return "";

  const logoOf = (contact: KeyContact | null | undefined): string => {
    if (!contact) return "";
    const raw =
      typeof contact.companyLogo === "string" ? contact.companyLogo.trim() : "";
    if (!raw) return "";
    if (raw.includes("placeholder")) return "";
    return raw;
  };

  const candidates = asContactList(keyContacts).filter(
    (c) => !!c && contactServesCategory(c, target) && !!logoOf(c),
  );
  if (candidates.length === 0) return "";

  const selected = options?.primaryContactId
    ? candidates.find((c) => c.id === options.primaryContactId)
    : undefined;
  const primary = candidates.find((c) => isCategoryPrimaryContact(c, target));
  return logoOf(selected ?? primary ?? candidates[0]);
}
