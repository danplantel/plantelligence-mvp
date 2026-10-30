import { describe, expect, it } from "vitest";

import { applyContactCardPresentation } from "@/lib/contact-card-presentation";
import type { HubContactCard } from "@/lib/teammates/hub-contacts.server";

/**
 * The portal builds contact cards from PROFILE + ASSIGNMENT, but the card's
 * settings — the CTA group and the "show on contact card" toggles — are authored
 * on the plan's stored contact row and are never mirrored onto the seat. These
 * tests pin the overlay that puts them back, and the rule that keeps it safe:
 * **the seat wins, the stored row only fills what the seat left unset.**
 */

function card(overrides: Partial<HubContactCard> = {}): HubContactCard {
  return {
    id: "c1",
    assignmentId: "a1",
    profileId: "p1",
    name: "Jane Advisor",
    firstName: "Jane",
    lastName: "Advisor",
    title: "Advisor",
    designations: [],
    designation: null,
    email: "jane@acme.test",
    phone: null,
    phoneExtension: null,
    headshot: null,
    companyName: null,
    companyLogo: null,
    showOnPortal: true,
    benefitsCategories: ["Retirement"],
    benefitsCategory: "Retirement",
    contactType: "individual",
    role: "editor",
    personType: "collaborator",
    hasAccess: false,
    ...overrides,
  } as HubContactCard;
}

describe("applyContactCardPresentation — CTA group", () => {
  it("restores the CTA the advisor saved on the contact row", () => {
    // The seat never configured a CTA; the stored row did. Without the overlay
    // the card renders no button at all.
    const target = card();
    applyContactCardPresentation(target, {
      enableContactButton: true,
      contactButtonType: "calendar",
      schedulingUrl: "https://book.test/jane",
    });

    expect(target.enableContactButton).toBe(true);
    expect(target.contactButtonType).toBe("calendar");
    expect(target.schedulingUrl).toBe("https://book.test/jane");
  });

  it("carries the first-party contact-form URL", () => {
    const target = card();
    applyContactCardPresentation(target, {
      enableContactButton: true,
      contactButtonType: "url",
      websiteUrl: "https://plantel.pro/contact?to=jane%40acme.test",
    });

    expect(target.contactButtonType).toBe("url");
    expect(target.websiteUrl).toBe("https://plantel.pro/contact?to=jane%40acme.test");
  });

  it("never overrides a CTA the seat itself set", () => {
    const target = card({
      enableContactButton: true,
      contactButtonType: "email",
      schedulingUrl: "https://seat.test/book",
    });
    applyContactCardPresentation(target, {
      enableContactButton: true,
      contactButtonType: "phone",
      schedulingUrl: "https://row.test/book",
    });

    expect(target.contactButtonType).toBe("email");
    expect(target.schedulingUrl).toBe("https://seat.test/book");
  });

  it("keeps a CTA the person disabled on their own seat", () => {
    // An explicit `false` on the seat is a decision, not a gap: the row must not
    // switch the button back on.
    const target = card({ enableContactButton: false });
    applyContactCardPresentation(target, { enableContactButton: true });

    expect(target.enableContactButton).toBe(false);
  });

  it("ignores a button type the cards do not understand", () => {
    const target = card();
    applyContactCardPresentation(target, {
      enableContactButton: true,
      contactButtonType: "carrier-pigeon",
    });

    expect(target.enableContactButton).toBe(true);
    expect(target.contactButtonType).toBeUndefined();
  });

  it("ignores blank URLs", () => {
    const target = card();
    applyContactCardPresentation(target, {
      schedulingUrl: "   ",
      websiteUrl: "",
    });

    expect(target.schedulingUrl).toBeUndefined();
    expect(target.websiteUrl).toBeUndefined();
  });
});

describe("applyContactCardPresentation — show/hide toggles", () => {
  it("takes the stored toggles when the seat never chose", () => {
    const target = card();
    applyContactCardPresentation(target, {
      displayEmail: false,
      displayPhone: true,
    });

    expect(target.displayEmail).toBe(false);
    expect(target.displayPhone).toBe(true);
  });

  it("keeps the seat's own toggles", () => {
    const target = card({ displayEmail: true, displayPhone: false });
    applyContactCardPresentation(target, {
      displayEmail: false,
      displayPhone: true,
    });

    expect(target.displayEmail).toBe(true);
    expect(target.displayPhone).toBe(false);
  });

  it("leaves non-boolean values alone", () => {
    const target = card();
    applyContactCardPresentation(target, { displayEmail: "false" });

    expect(target.displayEmail).toBeUndefined();
  });
});
