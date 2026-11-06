import { describe, expect, it } from "vitest";

import {
  contactIdFromAnchor,
  keyContactAnchor,
  portalEditAnchor,
  portalSectionId,
  PORTAL_SECTION_IDS,
} from "@/lib/portal-editor-sections";

/**
 * The address a portal page uses to point the Edit Panel at a section.
 *
 * The panel renders `[data-section-id={portalSectionId(section.title)}]` and the
 * page asks for that id, so this function is the whole contract between them.
 */

describe("portalSectionId", () => {
  it("slugifies the section titles the panel renders", () => {
    expect(portalSectionId("Hero Content")).toBe("hero-content");
    expect(portalSectionId("Mission Statement")).toBe("mission-statement");
    expect(portalSectionId("Typography")).toBe("typography");
    expect(portalSectionId("Images")).toBe("images");
    expect(portalSectionId("Disclosure")).toBe("disclosure");
  });

  it("survives punctuation, casing and stray whitespace", () => {
    expect(portalSectionId("  Have Questions? ")).toBe("have-questions");
    expect(portalSectionId("How Can We Help You Today?")).toBe(
      "how-can-we-help-you-today",
    );
    expect(portalSectionId("Branding & Messaging")).toBe("branding-messaging");
    expect(portalSectionId("Step 2 — Hero")).toBe("step-2-hero");
  });

  it("never leaves a leading or trailing dash", () => {
    expect(portalSectionId("  — Hero —  ")).toBe("hero");
  });
});

describe("PORTAL_SECTION_IDS", () => {
  it("names the sections the portal pages point at", () => {
    expect(PORTAL_SECTION_IDS).toEqual({
      heroContent: "hero-content",
      missionStatement: "mission-statement",
      disclosure: "disclosure",
      // Not sections, but anchors inside one: the Featured Image is the first
      // card of "Mission Statement", and the hero photograph is the second card
      // of "Images" — not of "Hero Content", which holds the banner copy.
      featuredImage: "featured-image",
      heroBackground: "hero-background",
    });
  });
});

describe("keyContactAnchor", () => {
  it("names one contact row from the contact's own id", () => {
    expect(keyContactAnchor("c1")).toBe("key-contact-c1");
    expect(keyContactAnchor(42)).toBe("key-contact-42");
  });

  it("reads the id back out, so the panel can tell a contact from a section", () => {
    expect(contactIdFromAnchor(keyContactAnchor(42))).toBe("42");
    expect(contactIdFromAnchor("key-contact-c1")).toBe("c1");
    // Anything else is not a contact request.
    expect(contactIdFromAnchor("disclosure")).toBeNull();
    expect(contactIdFromAnchor("hero-background")).toBeNull();
    expect(contactIdFromAnchor(null)).toBeNull();
  });
});

describe("portalEditAnchor", () => {
  it("addresses cards that live inside a section", () => {
    expect(portalEditAnchor.featuredImage).toBe("featured-image");
    expect(portalEditAnchor.heroBackground).toBe("hero-background");
    expect(portalEditAnchor.newsEventsHero).toBe("news-events-hero");
  });

  it("names Employee Resources' three panel sections, one anchor each", () => {
    expect(portalEditAnchor.employeeResourcesHero).toBe(
      "employee-resources-hero",
    );
    expect(portalEditAnchor.employeeResourcesHelp).toBe("employee-resources-help");
    expect(portalEditAnchor.employeeResourcesQuickAnswers).toBe(
      "employee-resources-quick-answers",
    );

    const anchors = Object.values(portalEditAnchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("keeps every anchor distinct from the section ids", () => {
    const sectionIds = [
      PORTAL_SECTION_IDS.heroContent,
      PORTAL_SECTION_IDS.missionStatement,
      PORTAL_SECTION_IDS.disclosure,
    ];
    expect(sectionIds).not.toContain(PORTAL_SECTION_IDS.heroBackground);
    expect(sectionIds).not.toContain(PORTAL_SECTION_IDS.featuredImage);
  });
});
