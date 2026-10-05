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

    out.push({
      // The contact's own id, so the card key and the tel:/mailto: links agree with the
      // same person on My Benefits Team.
      id: contactId,
      // The advisor's per-benefit copy wins; otherwise the person's own name/title.
      title: text(entry.title) || name || "Support Contact",
      description: text(entry.description) || text(contact.customRole) || text(contact.title),
      email: text(contact.email),
      phone: text(contact.phone),
      phoneExtension: text(contact.phoneExtension) || undefined,
      headshot: text(contact.headshot) || undefined,
    });
  }

  return out.length > 0 ? out : undefined;
}
