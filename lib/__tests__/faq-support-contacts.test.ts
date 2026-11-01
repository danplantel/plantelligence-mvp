import { describe, expect, it } from "vitest";

import { buildFaqSupportContacts } from "@/lib/faq-support-contacts";

/**
 * A benefit's support contacts, as the "Have Questions?" cards receive them.
 *
 * The field split is the thing worth pinning: `name` / `title` carry the PERSON's
 * name (readers did not always agree on which), and `description` carries their
 * role. Getting that wrong is not a cosmetic bug — the card prints `name` in its
 * headline slot, so a role landing there shows a job title as the person's name and
 * then repeats the same role on the line underneath.
 */

const planContacts = [
  {
    id: "c1",
    name: "Ada Advisor",
    title: "Retirement Specialist",
    email: "ada@acme.test",
  },
  { id: "c2", firstName: "Ben", lastName: "Broker" },
];

describe("buildFaqSupportContacts", () => {
  it("takes the person's NAME from the contact, not the per-contact label", () => {
    const contacts = buildFaqSupportContacts({
      keyContacts: planContacts,
      // The wizard writes a ROLE (or a blurb) into the entry's `title`.
      supportContacts: [
        {
          contactId: "c1",
          title: "Retirement Specialist",
          description: "",
          enabled: true,
        },
      ],
    });

    expect(contacts?.[0].name).toBe("Ada Advisor");
    // `title` is the legacy name carrier — it must never hold the role.
    expect(contacts?.[0].title).toBe("Ada Advisor");
    // The role travels in `description`, which the card prints underneath the name.
    expect(contacts?.[0].description).toBe("Retirement Specialist");
  });

  it("falls back to first + last name", () => {
    const contacts = buildFaqSupportContacts({
      keyContacts: planContacts,
      supportContacts: [{ contactId: "c2", title: "Broker", enabled: true }],
    });

    expect(contacts?.[0].name).toBe("Ben Broker");
  });

  it("reads the name from fullName or displayName too", () => {
    const contacts = buildFaqSupportContacts({
      keyContacts: [
        { id: "c3", fullName: "Cleo Consultant" },
        { id: "c4", displayName: "Dana Director" },
      ],
      supportContacts: [
        { contactId: "c3", enabled: true },
        { contactId: "c4", enabled: true },
      ],
    });

    expect(contacts?.map((contact) => contact.name)).toEqual([
      "Cleo Consultant",
      "Dana Director",
    ]);
  });

  it("skips disabled entries and ids that no longer resolve", () => {
    const contacts = buildFaqSupportContacts({
      keyContacts: planContacts,
      supportContacts: [
        { contactId: "c1", enabled: false },
        { contactId: "gone", enabled: true },
      ],
    });

    expect(contacts).toBeUndefined();
  });
});
