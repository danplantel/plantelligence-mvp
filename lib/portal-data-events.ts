/**
 * The portal Edit Panel's "what I just wrote, the page should re-read" signals.
 *
 * The panel writes through the API; the page reads through its own effect-based
 * fetches, which know nothing about that write. A window event is the smallest
 * honest bridge — the alternative is lifting every section's fetching into one
 * shared store, which is a much larger change than this needs.
 */

/** A meeting was created, edited or deleted. */
export const PORTAL_MEETINGS_CHANGED = "portal:meetings-changed";

/** Tell the page a meeting changed. Safe to call during SSR (it does nothing). */
export function notifyPortalMeetingsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PORTAL_MEETINGS_CHANGED));
}
