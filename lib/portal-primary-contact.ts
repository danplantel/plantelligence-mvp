/**
 * Resolve the person a benefit hub should feature as its key contact.
 *
 * Both the welcome banner and the video section name this person (signature,
 * "Schedule with [First Name]"), and "Have Questions?" features their card, so the
 * selection lives here once: the same category matches the same contact everywhere,
 * and a contact hidden from the portal is never promoted.
 *
 * Pure — no React, no fetching.
 */
export type PortalContact = Record<string, any>;

/** Read `keyContacts` in either shape the portal stores it. */
export function readPortalContacts(value: unknown): PortalContact[] {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is PortalContact => !!entry && typeof entry === "object",
    );
  }
  if (value && typeof value === "object") {
    const raw = value as { contacts?: unknown; Contacts?: unknown };
    const list = Array.isArray(raw.contacts)
      ? raw.contacts
      : Array.isArray(raw.Contacts)
      ? raw.Contacts
      : null;
    if (list) {
      return list.filter(
        (entry): entry is PortalContact => !!entry && typeof entry === "object",
      );
    }
  }
  return [];
}

/**
 * One spelling per benefit, for comparing a stored category to the one asked for.
 *
 * The wizard, the API and the card pills each have their own name for the plan's
 * custom hub — "Custom", "Other", "Company / Plan Sponsor" — so they are folded
 * together here rather than compared literally.
 */
export function normalizePortalCategory(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (text === "custom" || text === "other" || text === "other benefits") {
    return "company / plan sponsor";
  }
  if (text === "health insurance" || text === "group health") {
    return "group health";
  }
  if (text === "life insurance" || text === "group life") {
    return "group life";
  }
  return text;
}

/** Does this contact cover `category`? Checks the single value and the list. */
export function contactServesCategory(
  contact: PortalContact,
  category?: string | null,
): boolean {
  if (!category) return false;
  const target = normalizePortalCategory(category);
  if (!target) return false;

  const list = Array.isArray(contact.benefitsCategories)
    ? contact.benefitsCategories
    : [];
  const single = contact.benefitsCategory;
  return [single, ...list].some(
    (value) => !!value && normalizePortalCategory(value) === target,
  );
}

/**
 * Does this contact claim to be the KEY CONTACT for `category`?
 *
 * `isPrimaryByCategory` is the per-benefit claim the contact editor writes — the
 * advisor's own row usually carries it while its general `isPrimary` flag is false,
 * because "primary" there means primary FOR A BENEFIT, not the plan's main contact.
 * Ignoring this map is what made the banner name a different person (and left the
 * key-contact card unhighlighted): no contact matched `isPrimary`, so the resolver
 * dropped to "anyone tagged with the category" and picked a stranger.
 */
export function isCategoryKeyContact(
  contact: PortalContact,
  category?: string | null,
): boolean {
  if (!category) return false;
  const claims = contact.isPrimaryByCategory;
  if (!claims || typeof claims !== "object") return false;
  const target = normalizePortalCategory(category);
  return Object.entries(claims as Record<string, unknown>).some(
    ([key, value]) =>
      value === true && !!key && normalizePortalCategory(key) === target,
  );
}

/**
 * The category's key contact:
 *
 *  1. the contact CLAIMING that benefit (`isPrimaryByCategory[category]`),
 *  2. a primary contact tagged with the category,
 *  3. any contact tagged with the category,
 *  4. the plan's primary contact,
 *  5. the first visible contact.
 *
 * Contacts with `showOnPortal === false` are excluded from every step.
 */
export function resolvePortalPrimaryContact(
  keyContacts: unknown,
  category?: string | null,
): PortalContact | null {
  const visible = readPortalContacts(keyContacts).filter(
    (contact) => contact.showOnPortal !== false,
  );

  let primary: PortalContact | undefined;
  if (category) {
    primary =
      // The advisor's explicit "this person owns this benefit".
      visible.find((contact) => isCategoryKeyContact(contact, category)) ||
      visible.find(
        (contact) =>
          contact.isPrimary && contactServesCategory(contact, category),
      ) ||
      // Anyone tagged with the benefit — the original fallback.
      visible.find((contact) => contactServesCategory(contact, category));
  }

  if (!primary) {
    primary = visible.find((contact) => contact.isPrimary) || visible[0];
  }

  return primary || null;
}

/**
 * The contact whose card a benefit's "Have Questions?" row should FEATURE.
 *
 * The resolver's pick only counts when that person is actually one of the row's
 * cards: a plan-level contact who is not on this benefit cannot be highlighted, and
 * the row then featured nobody at all. Falling back to the first card tagged with
 * the benefit keeps the banner and the row naming the same person whenever the
 * resolver's pick is present, and guarantees a card is featured otherwise.
 */
export function resolveFeaturedContactId(
  contacts: { id?: unknown }[],
  keyContacts: unknown,
  category?: string | null,
): string {
  const resolvedId = String(
    resolvePortalPrimaryContact(keyContacts, category)?.id ?? "",
  );
  const hasResolved = contacts.some(
    (contact) => String(contact.id) === resolvedId,
  );
  if (resolvedId && hasResolved) return resolvedId;

  const fallback = (contacts as PortalContact[]).find((contact) =>
    contactServesCategory(contact, category),
  );
  return fallback ? String(fallback.id) : "";
}
