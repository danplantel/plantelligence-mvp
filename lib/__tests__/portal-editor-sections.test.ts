import { describe, expect, it } from "vitest";

import {
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
      // Not a section: the Featured Image is the first card of "Mission
      // Statement", so it is addressed as an anchor inside it.
      featuredImage: "featured-image",
    });
  });
});

describe("portalEditAnchor", () => {
  it("addresses cards that live inside a section", () => {
    expect(portalEditAnchor.featuredImage).toBe("featured-image");
  });
});
