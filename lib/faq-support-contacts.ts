/**
 * faq-support-contacts — map a benefit's `supportContacts` onto the `FAQContact[]`
 * the hub's "Have Questions?" cards render.
 *
 * The benefit's `supportContacts` is an EXPLICIT, per-benefit selection the advisor
 * made in Step 3 (`Benefit.supportContacts[].contactId`). Two rules, and only two:
 *
 *  1. **Resolve each entry against the plan's live contacts.** The portal's
 *     `keyContacts` is rebuilt from profile + assignment, so the matched card carries
 *     the person's CURRENT headshot, email and phone — a photo set once shows up
 *     everywhere the person appears.
 *  2. **Drop an entry whose `contactId` no longer resolves.** That is the one thing
 *     that makes a card wrong: a deleted contact or a stale pre-mirror id otherwise
 *     renders a photo-less "Support Contact" stub.
 *
 * Deliberately NOT `resolveCategoryContacts` here. That resolver additionally drops
 * any entry whose contact doesn't carry the benefit's category tag, which is right
 * for DERIVING a category's people but wrong for an explicit selection: Step 3's
 * roster is the plan's whole contact list, so the advisor can legitimately attach a
 * contact that was never tagged with this category — and that choice must stick.
 *
 * Pure — no React, no fetching.
 */

import type { FAQContact } from "@/components/faq-section";

interface BuildFaqSupportContactsInput {
  /** The plan's contact list as the portal already holds it (`keyContacts`). */
  keyContacts: unknown;
  /** The `Benefit.supportContacts` JSON. */
  supportContacts: unknown;
}

function readContactArray(value: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object") {
    const raw = value as { contacts?: unknown; Contacts?: unknown };
    if (Array.isArray(raw.contacts)) return raw.contacts as Record<string, unknown>[];
    if (Array.isArray(raw.Contacts)) return raw.Contacts as Record<string, unknown>[];
  }
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const CONTACT_BUTTON_TYPES = ["email", "phone", "calendar", "url"] as const;

/** Narrow a stored CTA type to the four the cards understand. */
function isContactButtonType(
  value: unknown,
): value is (typeof CONTACT_BUTTON_TYPES)[number] {
  return (
    typeof value === "string" &&
    (CONTACT_BUTTON_TYPES as readonly string[]).includes(value)
  );
}

/** Normalize a stored designation value into a cleaned list of strings. */
function textArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => text(entry)).filter(Boolean);
  }
  const single = text(value);
  return single ? [single] : [];
}

export function buildFaqSupportContacts({
  keyContacts,
  supportContacts,
}: BuildFaqSupportContactsInput): FAQContact[] | undefined {
  const contacts = readContactArray(keyContacts);
  if (!contacts) return undefined;

  if (!Array.isArray(supportContacts)) return undefined;
  const enabled = supportContacts.filter(
    (sc): sc is Record<string, unknown> =>
      !!sc && typeof sc === "object" && (sc as { enabled?: unknown }).enabled !== false,
  );
  if (enabled.length === 0) return undefined;

  const byId = new Map<string, Record<string, unknown>>();
  for (const contact of contacts) {
    const id = text(contact.id);
    if (id) byId.set(id, contact);
  }

  const out: FAQContact[] = [];
  for (const entry of enabled) {
    const contactId = text(entry.contactId);
    const contact = contactId ? byId.get(contactId) : undefined;
    // The person is gone (deleted, or a pre-mirror draft id) — nothing to render.
    if (!contact) continue;

    const name =
      text(contact.name) ||
      `${text(contact.firstName)} ${text(contact.lastName)}`.trim();

    // The person's own designations, each rendered on its own line under the job
    // title. Tolerates the earlier single-value shape.
    const designationList = textArray(contact.designations);
    const designations =
      designationList.length > 0 ? designationList : textArray(contact.designation);

    // Which categories this person serves. The "Company / Plan Sponsor" card
    // shows the plan's logo rather than the row's (see `HaveQuestions`), so the
    // category has to travel with the contact.
    const categoryList = textArray(contact.benefitsCategories);
    const categories =
      categoryList.length > 0 ? categoryList : textArray(contact.benefitsCategory);

    out.push({
      // The contact's own id, so the card key and the tel:/mailto: links agree with the
      // same person on My Benefits Team.
      id: contactId,
      // The card shows the person's NAME and, under it, their ROLE. `title` keeps
      // carrying the name so the pre-refactor shape (and any other reader) still
      // works; `name` is the explicit field the shared contact card reads.
      name: name || undefined,
      title: text(entry.title) || name || "Support Contact",
      // The card's subtitle is the PERSON's role, exactly as on My Benefits Team.
      // The per-benefit blurb the wizard used to write here ("Contact for any
      // questions regarding this benefit.") is only a fallback, so a contact with
      // a job title no longer shows boilerplate instead of their role.
      description:
        text(contact.customRole) ||
        text(contact.title) ||
        text(entry.description),
      // Each designation renders on its own line under the job title on the card.
      ...(designations.length > 0 ? { designations } : {}),
      email: text(contact.email),
      phone: text(contact.phone),
      phoneExtension: text(contact.phoneExtension) || undefined,
      headshot: text(contact.headshot) || undefined,
      // The same card as My Benefits Team, so it needs the same affordances: a
      // booking link, the company that owns the card, and the outbound URL.
      ...(text(contact.schedulingUrl)
        ? { schedulingUrl: text(contact.schedulingUrl) }
        : {}),
      // The CTA the advisor configured, exactly as stored. Its absence is
      // meaningful — the card then draws no button instead of inventing one.
      ...(typeof contact.enableContactButton === "boolean"
        ? { enableContactButton: contact.enableContactButton }
        : {}),
      ...(isContactButtonType(contact.contactButtonType)
        ? { contactButtonType: contact.contactButtonType }
        : {}),
      ...(text(contact.companyName) ? { companyName: text(contact.companyName) } : {}),
      ...(text(contact.companyLogo) ? { companyLogo: text(contact.companyLogo) } : {}),
      ...(categories.length > 0 ? { benefitsCategories: categories } : {}),
      ...(text(contact.websiteUrl) ? { websiteUrl: text(contact.websiteUrl) } : {}),
    });
  }

  return out.length > 0 ? out : undefined;
}
