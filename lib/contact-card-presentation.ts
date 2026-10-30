/**
 * contact-card-presentation — overlay the card settings authored on a plan's
 * stored contact row onto the card the portal derives from that person's seat.
 *
 * WHY THIS EXISTS
 *
 * The portal builds its contact cards from PROFILE + ASSIGNMENT (T7), not from
 * the stored `Client.keyContacts` array. That is right for a person's details —
 * name, email, phone, headshot — because those belong to the profile.
 *
 * It is wrong for the CARD: the "Show on contact card" toggles and the CTA group
 * (`enableContactButton` / `contactButtonType` / `schedulingUrl` / `websiteUrl`)
 * are authored by the advisor in the contacts editor and sit ONLY on the stored
 * row. Nothing mirrors them onto the seat, so every card the portal built from a
 * mirrored person came out with the CTA suppressed — the button the advisor had
 * configured simply never reached the participant.
 *
 * The rule is therefore "the seat wins, the stored row fills the gaps": a value
 * the person set on their own seat (including an explicit `false`, which hides a
 * button) is never overwritten, and anything the seat never set is taken from the
 * row the advisor authored.
 */

import type { HubContactCard } from "@/lib/teammates/hub-contacts.server";

const CONTACT_BUTTON_TYPES = ["email", "phone", "calendar", "url"] as const;

type ContactButtonType = (typeof CONTACT_BUTTON_TYPES)[number];

/** Narrow a stored CTA type to the four the cards understand. */
function isContactButtonType(value: unknown): value is ContactButtonType {
  return (
    typeof value === "string" &&
    (CONTACT_BUTTON_TYPES as readonly string[]).includes(value)
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Copy the stored row's card presentation onto `card`, filling only the fields
 * the seat left unset. Mutates `card` (the callers own the array being built).
 */
export function applyContactCardPresentation(
  card: HubContactCard,
  stored: Record<string, unknown>,
): void {
  // The CTA group travels together: a stored `enableContactButton` is what makes
  // the card draw a button at all, and the type/URLs are what that button does.
  if (card.enableContactButton == null) {
    if (typeof stored.enableContactButton === "boolean") {
      card.enableContactButton = stored.enableContactButton;
    }
  }
  if (card.contactButtonType == null && isContactButtonType(stored.contactButtonType)) {
    card.contactButtonType = stored.contactButtonType;
  }
  if (!card.schedulingUrl && text(stored.schedulingUrl)) {
    card.schedulingUrl = text(stored.schedulingUrl);
  }
  if (!card.websiteUrl && text(stored.websiteUrl)) {
    card.websiteUrl = text(stored.websiteUrl);
  }

  // The show/hide toggles. A seat that never chose leaves them null, which the
  // cards read as "show"; the stored `false` must still hide the row.
  if (card.displayEmail == null && typeof stored.displayEmail === "boolean") {
    card.displayEmail = stored.displayEmail;
  }
  if (card.displayPhone == null && typeof stored.displayPhone === "boolean") {
    card.displayPhone = stored.displayPhone;
  }

  if (card.contactFormTopics === undefined && stored.contactFormTopics !== undefined) {
    card.contactFormTopics = stored.contactFormTopics;
  }
}
