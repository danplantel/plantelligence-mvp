/**
 * contact-cta — how many call-to-action buttons a contact card can carry, which ones
 * an advisor configured, and how they are stored.
 *
 * The contact editors (Create Plan's Step 1/Step 3 forms, Edit Plan, the benefit
 * contact dialog and the Team Seat invitation) all offer the same four actions, allow
 * the same maximum, and store the same shape. Keeping that in ONE module is what stops
 * one entry point from allowing a second button while another silently drops it.
 *
 * Storage: `contactButtonTypes` is the current field (0–2 entries, in the advisor's
 * order). `contactButtonType` — the original single value — is still written alongside
 * it (the first choice) so older readers keep working, and is used as a one-entry
 * fallback when the array is missing.
 */

/** The CTA a contact can be given, in the STORED spelling (`contactButtonTypes`). */
export type ContactCtaType = "calendar" | "phone" | "email" | "url";

/**
 * The editor's choices, in the order the pickers list them. `value` is the editor's
 * own word for the action; `stored` is what the contact stores and the cards read.
 */
export const CONTACT_CTA_OPTIONS = [
  {
    value: "schedule",
    label: "Schedule Appt.",
    stored: "calendar",
    /** What the button will do, for the picker's helper text. */
    hint: "Opens the advisor's booking link.",
  },
  {
    value: "call",
    label: "Call",
    stored: "phone",
    hint: "Dials the contact's phone number.",
  },
  {
    value: "email",
    label: "Email",
    stored: "email",
    hint: "Starts an email to the contact.",
  },
  {
    value: "contact",
    label: "Contact Form",
    stored: "url",
    hint: "Opens the Plantelligence contact form.",
  },
] as const;

/** The editor's spelling of an action (`schedule` / `call` / `email` / `contact`). */
export type ContactCtaOption = (typeof CONTACT_CTA_OPTIONS)[number]["value"];

/** How many CTAs one contact card carries — they share one row of buttons. */
export const MAX_CTAS_PER_CONTACT = 2;

const STORED_CTA_TYPES: readonly ContactCtaType[] = [
  "calendar",
  "phone",
  "email",
  "url",
] as const;

/**
 * Coerce whatever an editor saved into its selectable actions.
 *
 * Accepts the array (`ctaTypes`) or the older single `ctaType`, drops unknown
 * values, removes duplicates and applies the two-action ceiling — so a draft,
 * a stored row, or an invitation written by an older release can never put a
 * third button (or a dead one) in front of the advisor.
 */
export function normalizeContactCtaOptions(raw: unknown): ContactCtaOption[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string" && raw
      ? [raw]
      : [];
  const known = values.filter((value): value is ContactCtaOption =>
    CONTACT_CTA_OPTIONS.some((option) => option.value === value),
  );
  return Array.from(new Set(known)).slice(0, MAX_CTAS_PER_CONTACT);
}

/** Editor choices → the values the contact stores (in the order given). */
export function toStoredCtaTypes(options: ContactCtaOption[]): ContactCtaType[] {
  return options
    .map((value) => CONTACT_CTA_OPTIONS.find((o) => o.value === value)?.stored)
    .filter((value): value is ContactCtaType => !!value);
}

/** A stored contact's CTAs → the editor's choices, in the advisor's order. */
export function toContactCtaOptions(contact: unknown): ContactCtaOption[] {
  const entry = (contact ?? {}) as Record<string, unknown>;
  const stored = configuredContactCtas(entry);
  return stored
    .map((type) => CONTACT_CTA_OPTIONS.find((o) => o.stored === type)?.value)
    .filter((value): value is ContactCtaOption => !!value);
}

/**
 * The CTAs configured for a contact, in the order the advisor chose them.
 *
 * De-duplicated and capped at `MAX_CTAS_PER_CONTACT`, so a stored value from another
 * release (a longer list, an unknown type, a string instead of an array) can never put
 * a third button — or a dead one — on a card.
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
    STORED_CTA_TYPES.includes(value as ContactCtaType),
  );

  return Array.from(new Set(known)).slice(0, MAX_CTAS_PER_CONTACT);
}

/** Does this contact carry a CTA at all? */
export function contactHasCta(contact: unknown): boolean {
  return configuredContactCtas(contact).length > 0;
}

/**
 * The CTA fields to write on a contact, from the editor's selection.
 *
 * Every editor saves through this, so the legacy single-value field, the array and the
 * older display flags can never disagree — and a contact with nothing selected saves
 * with no CTA at all rather than a button that does nothing.
 */
export function ctaSaveFields(options: ContactCtaOption[]): {
  displayUrl: boolean;
  displayScheduleAppointment: boolean;
  enableContactButton: boolean;
  contactButtonType: ContactCtaType | undefined;
  contactButtonTypes: ContactCtaType[];
  /** Only meaningful for a "Schedule Appt." CTA — pass the typed link through. */
  schedulingUrl: string | undefined;
} {
  const stored = toStoredCtaTypes(options).slice(0, MAX_CTAS_PER_CONTACT);
  return {
    displayUrl: stored.includes("url"),
    displayScheduleAppointment: stored.includes("calendar"),
    enableContactButton: stored.length > 0,
    contactButtonType: stored[0],
    contactButtonTypes: stored,
    schedulingUrl: undefined,
  };
}
