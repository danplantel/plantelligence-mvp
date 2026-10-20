/**
 * Resolve the person a benefit hub should feature as its key contact.
 *
 * Both the welcome banner and the video section name this person (signature,
 * "Schedule with [First Name]"), so the selection lives here once: the same
 * category matches the same contact on both, and a contact hidden from the
 * portal is never promoted.
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
 * The category's key contact:
 *
 *  1. a primary contact tagged with the category,
 *  2. any contact tagged with the category,
 *  3. the plan's primary contact,
 *  4. the first visible contact.
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

  const categoryMatches = (contact: PortalContact) => {
    if (!category) return false;
    const target = category.toLowerCase();
    if (String(contact.benefitsCategory || "").toLowerCase() === target) {
      return true;
    }
    return (
      Array.isArray(contact.benefitsCategories)
        ? contact.benefitsCategories
        : []
    )
      .map((value: unknown) => String(value).toLowerCase())
      .includes(target);
  };

  let primary: PortalContact | undefined;
  if (category) {
    primary =
      visible.find(
        (contact) => contact.isPrimary && categoryMatches(contact),
      ) || visible.find(categoryMatches);
  }

  if (!primary) {
    primary = visible.find((contact) => contact.isPrimary) || visible[0];
  }

  return primary || null;
}
