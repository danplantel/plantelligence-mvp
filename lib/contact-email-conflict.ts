/**
 * Contact email conflicts.
 *
 * A plan's Contacts are matched to the people the server knows — the organization
 * owner and Team Members — by EMAIL ALONE. A contact carries no profile id and a
 * profile carries no contact id, so the assignment seat ladder resolves "is this
 * person the owner / a Team Member?" with a lowercased email comparison.
 *
 * That makes a reused address a correctness problem, not just a tidy-up: a second
 * contact that borrows the owner's address is rendered as the organization owner,
 * because nothing else distinguishes the two. The same holds for a Team Member's
 * address — the borrowed contact is labelled with that teammate's seat.
 *
 * This module is the one place that decision is made, so both contact editors (the
 * Client Plan editor and the shared Benefits editor) refuse the same addresses with
 * the same wording. It is pure and client-safe; the caller supplies the rosters.
 */

/** A contact already on the plan, as either editor holds it. */
export interface ContactEmailEntry {
  id?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

/**
 * A plan assignment row, as `/api/teammates/plan-assignments` returns it.
 *
 * Only the fields the conflict rule needs: the address, a label, and what the row
 * actually is, so mirrored contacts can be told apart from real seat-holders.
 */
export interface TeammateEmailEntry {
  email?: string | null;
  name?: string | null;
  /** `personType` off the assignment row ("contact" for a T7 mirror). */
  personType?: string | null;
  /** `state` off the assignment row ("contact" for a T7 mirror). */
  state?: string | null;
}

export type ContactEmailConflictKind = "owner" | "teammate" | "contact";

export interface ContactEmailConflict {
  kind: ContactEmailConflictKind;
  /** The conflicting address, lowercased. */
  email: string;
  /** Who already uses it, for a message that names them. */
  label: string;
  /** Ready-to-render explanation. */
  message: string;
}

/** Lowercase + trim, the same normalization the seat ladder uses. */
export function normalizeContactEmail(email?: string | null): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Wording used when the caller wants to hide WHY the address is taken (Create Plan).
 * The advisor only needs to know the address is not free, not that it belongs to the
 * owner or a teammate.
 */
export const GENERIC_CONTACT_EMAIL_CONFLICT_MESSAGE =
  "Another contact is already using this email address. Each contact needs a unique email.";

/** Best display name for a contact row. */
function contactDisplayName(entry: ContactEmailEntry): string {
  const explicit = (entry.name || "").trim();
  if (explicit) return explicit;
  return `${entry.firstName || ""} ${entry.lastName || ""}`.trim();
}

/**
 * Whether a plan assignment actually holds a seat.
 *
 * The T7 contact mirror creates a `PlanAssignment` for EVERY key contact, so an
 * ordinary mirrored contact sits on the plan with `state: "contact"` (and/or
 * `personType: "contact"`) — no seat, no invitation. Treating those as "already a
 * Team Member" would flag a contact against itself. Only a row whose state is a real
 * lifecycle state (invited / active / deactivated) counts.
 */
export function isSeatHoldingAssignment(entry: TeammateEmailEntry): boolean {
  const personType = (entry.personType || "").trim().toLowerCase();
  if (personType === "contact") return false;
  const state = (entry.state || "").trim().toLowerCase();
  if (!state || state === "contact") return false;
  return true;
}

/**
 * The conflict for `email`, or `null` when the address is free.
 *
 * Precedence is owner → teammate → contact, because the owner/teammate cases are the
 * ones that mislabel a card; a duplicate contact is the milder "two rows, one
 * address" case. The first match wins and its message names the holder.
 */
export function findContactEmailConflict({
  email,
  excludeContactId,
  originalEmail,
  genericMessage = false,
  contacts = [],
  ownerEmails = [],
  teammates = [],
}: {
  email?: string | null;
  /** The contact being edited, excluded from the duplicate check. */
  excludeContactId?: string | null;
  /**
   * The address the contact being edited already had, if any.
   *
   * An owner's OWN contact row legitimately carries the owner's address (the seeded
   * advisor contact, for one), so blocking that row would make it uneditable. When the
   * submitted address is unchanged from the row's, the owner/teammate rule is skipped —
   * only a NEWLY borrowed address is refused. A changed address is checked in full.
   */
  originalEmail?: string | null;
  /** Replace the specific holder with one generic sentence (Create Plan). */
  genericMessage?: boolean;
  contacts?: ContactEmailEntry[] | null;
  ownerEmails?: string[] | null;
  teammates?: TeammateEmailEntry[] | null;
}): ContactEmailConflict | null {
  const normalized = normalizeContactEmail(email);
  if (!normalized) return null;

  // The row already represents this address — its owner/teammate match is expected.
  const alreadyBelongs =
    !!originalEmail && normalizeContactEmail(originalEmail) === normalized;

  const owners = new Set(
    (ownerEmails || []).map((address) => normalizeContactEmail(address)).filter(Boolean),
  );
  if (owners.has(normalized) && !alreadyBelongs) {
    return {
      kind: "owner",
      email: normalized,
      label: "your organization's owner",
      message: genericMessage
        ? GENERIC_CONTACT_EMAIL_CONFLICT_MESSAGE
        : "This email belongs to your organization's owner. A contact using the same address would be shown as the organization owner, so each needs its own email. Enter a different address.",
    };
  }

  const teammate = (teammates || []).find(
    (entry) =>
      isSeatHoldingAssignment(entry) &&
      normalizeContactEmail(entry.email) === normalized,
  );
  if (teammate && !alreadyBelongs) {
    const label =
      (teammate.name || "").trim() || teammate.email || "a Team Member";
    return {
      kind: "teammate",
      email: normalized,
      label,
      message: genericMessage
        ? GENERIC_CONTACT_EMAIL_CONFLICT_MESSAGE
        : `${label} already uses this email as a Team Member. A contact with the same address would be labelled as that teammate. Enter a different address.`,
    };
  }

  const duplicate = (contacts || []).find(
    (entry) =>
      normalizeContactEmail(entry.email) === normalized &&
      (entry.id || null) !== (excludeContactId || null),
  );
  if (duplicate) {
    const label = contactDisplayName(duplicate) || duplicate.email || "Another contact";
    return {
      kind: "contact",
      email: normalized,
      label,
      message: genericMessage
        ? GENERIC_CONTACT_EMAIL_CONFLICT_MESSAGE
        : `${label} already uses this email on this plan. Each contact needs a unique address.`,
    };
  }

  return null;
}
