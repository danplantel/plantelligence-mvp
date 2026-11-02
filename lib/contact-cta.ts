/**
 * contact-cta — how many call-to-action buttons a contact card can carry, and which
 * ones an advisor configured.
 *
 * The wizard's contact editor lets the advisor pick up to TWO actions for a person
 * (Schedule Appt., Call, Email, Contact Form). The cards draw them side by side in a
 * single row, so two is the ceiling everywhere: a third would have to wrap, and the
 * contact form itself only ever configures the one contact.
 *
 * `contactButtonTypes` is the current field. `contactButtonType` — the original
 * single-value field — is still written alongside it (first choice) so older readers
 * keep working, and is used as a one-entry fallback when the array is missing.
 */

/** The CTA a contact can be given, in the STORED spelling (`contactButtonTypes`). */
export type ContactCtaType = "calendar" | "phone" | "email" | "url";

/** How many CTAs one contact card carries — they share one row of buttons. */
export const MAX_CTAS_PER_CONTACT = 2;

const KNOWN_CTA_TYPES: readonly ContactCtaType[] = [
  "calendar",
  "phone",
  "email",
  "url",
] as const;

/**
 * The CTAs configured for a contact, in the order the advisor chose them.
 *
 * De-duplicated and capped at `MAX_CTAS_PER_CONTACT`, so a stored value from another
 * release (a longer list, an unknown type, a string instead of an array) can never
 * put a third button — or a dead one — on a card.
 */
export function configuredContactCtas(contact: unknown): ContactCtaType[] {
  const entry = (contact ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(entry.contactButtonTypes)
    ? entry.contactButtonTypes
    : entry.enableContactButton === true &&
      typeof entry.contactButtonType === "string"
    ? [entry.contactButtonType]
    : [];

  const known = raw.filter((value): value is ContactCtaType =>
    KNOWN_CTA_TYPES.includes(value as ContactCtaType),
  );

  return Array.from(new Set(known)).slice(0, MAX_CTAS_PER_CONTACT);
}

/**
 * Does this contact carry a CTA at all?
 *
 * True for the array field, and for the single-value field the older editor wrote.
 * A contact the advisor never gave a button renders none — no default is invented.
 */
export function contactHasCta(contact: unknown): boolean {
  return configuredContactCtas(contact).length > 0;
}
