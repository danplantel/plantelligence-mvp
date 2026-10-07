/**
 * Desktop-only access configuration.
 *
 * Onboarding setup and the advisor dashboard target desktop/laptop screens
 * (minimum ~1024px wide). Below that width we replace the surface with a
 * "use a computer" notice instead of rendering it.
 *
 * Deliberately NOT gated by anything here:
 *  - Account creation (name / email / password) works on any device.
 *  - The participant-facing Benefits Hub (the `(portal)` route group) stays
 *    fully mobile.
 *
 * The breakpoint and every piece of user-facing copy live in this module so a
 * surface can be re-pointed or re-worded without touching the components that
 * enforce the gate.
 */

/** Minimum viewport width (px) at which the setup wizard and dashboard render. */
export const DESKTOP_ONLY_MIN_WIDTH_PX = 1024;

/** The CSS media query the gate matches against. */
export const DESKTOP_ONLY_MEDIA_QUERY = `(min-width: ${DESKTOP_ONLY_MIN_WIDTH_PX}px)`;

/**
 * How long before the onboarding "resume" email may be sent again for the same
 * account. [MEDIUM] requirement: a mobile visitor to `/onboarding` is emailed a
 * link to pick up where they left off, but never more than once a day.
 */
export const ONBOARDING_RESUME_EMAIL_THROTTLE_MS = 24 * 60 * 60 * 1000;

/** Which surface the notice is shown for — selects the copy below. */
export type DesktopOnlyVariant = "onboarding" | "dashboard";

export interface DesktopOnlyCopy {
  /** Headline of the blocking notice. */
  title: string;
  /** Supporting line under the headline. */
  body: string;
}

/**
 * Per-surface copy for the blocking notice. Split into title/body so the layout
 * is shared while the wording stays specific to setup vs. the dashboard.
 */
export const DESKTOP_ONLY_COPY: Record<DesktopOnlyVariant, DesktopOnlyCopy> = {
  onboarding: {
    title: "PlanTelligence setup works best on a computer",
    body: "We've emailed you a link to pick up where you left off.",
  },
  dashboard: {
    title: "PlanTelligence works best on a computer",
    body: "The dashboard is built for desktop and laptop screens. Please switch to a larger device to continue.",
  },
};
