import { describe, expect, it } from "vitest";

import {
  readPortalContacts,
  resolvePortalPrimaryContact,
} from "../portal-primary-contact";

/**
 * `resolvePortalPrimaryContact` is the portal's "who is this benefit's person?"
 * helper — the welcome banner and the video section both use it, so the person
 * they name must be the same one.
 *
 * It is **not** what My Benefits Team uses: that page treats the first visible
 * contact as primary. The two rules are pinned side by side (here and in the
 * page's own suite) so changing either is a decision rather than an accident.
 *
 * The ladder is: a primary tagged with the category → any contact tagged with
 * the category → the plan's primary → the first visible contact. A contact with
 * `showOnPortal: false` is excluded from every step.
 */

function contact(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    name: "Ada",
    showOnPortal: true,
    ...overrides,
  };
}

describe("readPortalContacts", () => {
  it("reads a plain array, dropping non-objects", () => {
    expect(
      readPortalContacts([contact({ id: "a" }), null, "junk", contact({ id: "b" })]),
    ).toEqual([contact({ id: "a" }), contact({ id: "b" })]);
  });

  it("reads the { contacts } envelope", () => {
    expect(readPortalContacts({ contacts: [contact({ id: "a" })] })).toEqual([
      contact({ id: "a" }),
    ]);
  });

  it("reads the legacy { Contacts } envelope", () => {
    expect(readPortalContacts({ Contacts: [contact({ id: "a" })] })).toEqual([
      contact({ id: "a" }),
    ]);
  });

  it("returns nothing for a missing or unusable payload", () => {
    expect(readPortalContacts(null)).toEqual([]);
    expect(readPortalContacts(undefined)).toEqual([]);
    expect(readPortalContacts({})).toEqual([]);
    expect(readPortalContacts("nope")).toEqual([]);
  });
});

describe("resolvePortalPrimaryContact", () => {
  it("prefers a primary contact tagged with the category", () => {
    const result = resolvePortalPrimaryContact(
      [
        contact({ id: "other", benefitsCategories: ["Group Life"] }),
        contact({
          id: "health-primary",
          isPrimary: true,
          benefitsCategories: ["Group Health"],
        }),
      ],
      "Group Health",
    );

    expect(result?.id).toBe("health-primary");
  });

  it("falls back to any contact tagged with the category", () => {
    const result = resolvePortalPrimaryContact(
      [
        contact({ id: "plan-primary", isPrimary: true }),
        contact({ id: "life", benefitsCategories: ["Group Life"] }),
      ],
      "Group Life",
    );

    expect(result?.id).toBe("life");
  });

  it("falls back to the plan's primary when no contact matches the category", () => {
    const result = resolvePortalPrimaryContact(
      [
        contact({ id: "first" }),
        contact({ id: "plan-primary", isPrimary: true }),
      ],
      "Retirement",
    );

    expect(result?.id).toBe("plan-primary");
  });

  it("falls back to the first visible contact with no category or match", () => {
    expect(
      resolvePortalPrimaryContact([contact({ id: "first" })], "Retirement")?.id,
    ).toBe("first");
    expect(resolvePortalPrimaryContact([contact({ id: "first" })])?.id).toBe(
      "first",
    );
  });

  it("never promotes a contact hidden from the portal", () => {
    const result = resolvePortalPrimaryContact(
      [
        contact({
          id: "hidden-primary",
          isPrimary: true,
          benefitsCategories: ["Retirement"],
          showOnPortal: false,
        }),
        contact({
          id: "visible",
          benefitsCategories: ["Retirement"],
        }),
      ],
      "Retirement",
    );

    expect(result?.id).toBe("visible");
  });

  it("matches the singular benefitsCategory, case-insensitively", () => {
    const result = resolvePortalPrimaryContact(
      [contact({ id: "health", benefitsCategory: "group health" })],
      "Group Health",
    );

    expect(result?.id).toBe("health");
  });

  it("returns null when there is nobody to feature", () => {
    expect(resolvePortalPrimaryContact(null)).toBeNull();
    expect(resolvePortalPrimaryContact([])).toBeNull();
    expect(
      resolvePortalPrimaryContact([contact({ showOnPortal: false })]),
    ).toBeNull();
  });

  it("differs from the team page's first-visible rule", () => {
    const contacts = {
      contacts: [
        contact({ id: "first", name: "First" }),
        contact({
          id: "retirement",
          name: "Retirement specialist",
          benefitsCategories: ["Retirement"],
        }),
      ],
    };

    // The hub features the category's person…
    expect(resolvePortalPrimaryContact(contacts, "Retirement")?.id).toBe(
      "retirement",
    );
    // …while My Benefits Team marks the array's first visible contact as primary.
    expect((contacts.contacts[0] as { id: string }).id).toBe("first");
  });
});
