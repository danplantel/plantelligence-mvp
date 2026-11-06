/**
 * How a portal Edit Panel section is addressed from the page beside it.
 *
 * The Create/Edit Client and Benefits previews let the advisor click the part of
 * the page they want to change, and the panel scrolls to that section. The portal
 * does the same thing, and it needs an address for "that section": the panel
 * renders each section inside `[data-section-id]`, and the page asks the provider
 * for that id.
 *
 * The id is derived from the section's TITLE, because that is the one thing the
 * shared section builders (`usePlanPreviewEditorSections`, the benefits panel,
 * the hand-written portal sections) all have. Deriving it in one function is what
 * keeps the page and the panel from disagreeing about the spelling.
 */

/** Slug a panel section's title into the id the panel renders it with. */
export function portalSectionId(title: string): string {
  return String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * An anchor INSIDE a panel section.
 *
 * Some regions of the page are edited by a card part-way down a section rather
 * than by the section as a whole — the Featured Image is the first card of
 * "Mission Statement", not a section of its own. The panel marks those cards with
 * `data-edit-anchor`, and the scroll looks for one when no section matches.
 */
export const portalEditAnchor = {
  featuredImage: "featured-image",
} as const;

/**
 * The sections the portal pages point at.
 *
 * Only the ones a page's own region maps to are listed: the Landing Page's hero
 * and mission, and the Disclosure section every portal panel carries.
 */
export const PORTAL_SECTION_IDS = {
  heroContent: portalSectionId("Hero Content"),
  missionStatement: portalSectionId("Mission Statement"),
  disclosure: portalSectionId("Disclosure"),
  /**
   * The plan's Featured Image (the `thumbnail` brand slot). It is edited by the
   * first card of the Mission Statement section, so it is an anchor, not a
   * section: pointing at "Images" landed the advisor on Company Logo.
   */
  featuredImage: portalEditAnchor.featuredImage,
} as const;
