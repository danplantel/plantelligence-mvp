/**
 * Element ids the portal chrome scrolls to.
 *
 * Kept in one place so the button that scrolls and the section that is scrolled
 * to cannot drift apart — and so neither has to import the other's component.
 */

/** `id` of the "How Can We Help You Today?" section on every Benefit Hub. */
export const HOW_CAN_WE_HELP_SECTION_ID = "how-can-we-help";

/** `id` of the "Have Questions?" support-contact band that closes every hub. */
export const HAVE_QUESTIONS_SECTION_ID = "have-questions";

/**
 * Smooth-scroll the page to a portal section.
 *
 * `scroll-mt-*` on the target keeps its heading clear of the fixed portal header.
 * No-op during SSR or when the section is not on this page (the hubs hide some of
 * them), so callers can wire it to a button without a guard.
 */
export function scrollToPortalSection(sectionId: string): void {
  if (typeof document === "undefined") return;
  document
    .getElementById(sectionId)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
