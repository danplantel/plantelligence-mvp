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
/**
 * The BENEFIT editor's sections, as its four hub pages address them.
 *
 * That panel numbers eight sections, but a hub page is only five regions: the
 * banner's photograph, the journey section's video, "How Can We Help You Today?",
 * Quick Answers, and the closing band whose key contact it styles. The other three
 * (Portal Header Button, Typography, Benefit Messaging) belong to the panel's own
 * list rather than to a region a participant can point at.
 *
 * Anchors, not section ids: this panel renders its sections as children of the
 * wrapper (like Employee Resources), so the wrapper's automatic `[data-section-id]`
 * never applies to them.
 */
export const benefitEditAnchor = {
  /** Section 3 — the hero photograph behind the welcome copy. */
  heroImage: "benefit-hero-image",
  /** Section 3 — the benefit provider's logo, printed under the banner's portrait. */
  providerLogo: "benefit-provider-logo",
  /** Section 3 — the welcome banner's circular portrait override. */
  keyContactImage: "benefit-key-contact-image",
  /** Section 4 — the banner's headline and description. */
  messaging: "benefit-messaging",
  /** Section 5 — the journey section's video, poster and fallback image. */
  video: "benefit-video",
  /** Section 6 — the "How Can We Help You Today?" cards and Account Access. */
  help: "benefit-help",
  /** Section 7 — the Quick Answers groups. */
  quickAnswers: "benefit-quick-answers",
  /** Section 8 — how the closing band's key contact is drawn. */
  haveQuestions: "benefit-have-questions",
} as const;

/** The prefix every contact row's anchor carries. */
const KEY_CONTACT_PREFIX = "key-contact-";

/**
 * The anchor that addresses ONE contact row inside the team panel.
 *
 * My Benefits Team draws a card per contact, and the panel draws the same contacts
 * as collapsible rows. The page's blue button names the row, the panel opens it,
 * and the scroll lands on it — all three read this one function, so a row can never
 * be addressed by two spellings.
 */
export function keyContactAnchor(contactId: string | number): string {
  return `${KEY_CONTACT_PREFIX}${contactId}`;
}

/**
 * The contact id inside a contact anchor, or `null` for any other id.
 *
 * The panel needs this to tell "open this contact" apart from the section ids it
 * also receives through the same request. Always a string: ids read back from the
 * plan's JSON can be numbers, and comparing them by value would silently miss.
 */
export function contactIdFromAnchor(
  anchor: string | null | undefined,
): string | null {
  const value = String(anchor ?? "");
  return value.startsWith(KEY_CONTACT_PREFIX)
    ? value.slice(KEY_CONTACT_PREFIX.length)
    : null;
}

export const portalEditAnchor = {
  /** The Landing Page's Featured Image (first card of "Mission Statement"). */
  featuredImage: "featured-image",
  /**
   * The Landing Page's hero photograph ("Hero Banner Image", second card of
   * "Images"). NOT a section: "Hero Content" holds the welcome statement and the
   * banner-overlay settings, so pointing the photograph at it landed on the copy.
   */
  heroBackground: "hero-background",
  /** News & Events' hero background (Section 1 of that page's panel). */
  newsEventsHero: "news-events-hero",
  /** Employee Resources' header photograph (panel Section 1). */
  employeeResourcesHero: "employee-resources-hero",
  /** Employee Resources' "How Can We Help You Today?" cards (Section 2). */
  employeeResourcesHelp: "employee-resources-help",
  /** Employee Resources' Quick Answers groups (Section 3). */
  employeeResourcesQuickAnswers: "employee-resources-quick-answers",
} as const;

/**
 * The sections the portal pages point at.
 *
 * Only the ones a page's own region maps to are listed: the Landing Page's hero
 * and mission, and the Disclosure section every portal panel carries.
 */
export const PORTAL_SECTION_IDS = {
  heroContent: portalSectionId("Hero Content"),
  /** The hero photograph, addressed as an anchor inside "Images". */
  heroBackground: portalEditAnchor.heroBackground,
  missionStatement: portalSectionId("Mission Statement"),
  /**
   * Section 5 — the four "Your Benefits at a Glance" cards. Derived from the
   * section TITLE the Landing panel gives it, so the page's button and the panel's
   * `[data-section-id]` cannot be spelled differently.
   */
  benefitsGlance: portalSectionId("Your Benefits at a Glance"),
  disclosure: portalSectionId("Disclosure"),
  /**
   * The plan's Featured Image (the `thumbnail` brand slot). It is edited by the
   * first card of the Mission Statement section, so it is an anchor, not a
   * section: pointing at "Images" landed the advisor on Company Logo.
   */
  featuredImage: portalEditAnchor.featuredImage,
} as const;
