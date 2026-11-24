/**
 * How long a portal asset's text may be.
 *
 * These were literals inside `MarketingAssetModal` — `maxLength={80}` on the
 * top-banner headline and `maxLength={300}` on every body — while the portal's
 * News & Events panel had no caps at all, so a headline could be typed there
 * that the tool would refuse to save. One source, used by both.
 */

/** The top banner's headline cap — the longest a portal asset headline may be. */
export const PORTAL_ASSET_HEADLINE_MAX = 80;

/**
 * A TOP BANNER's headline is chrome above the portal header — one line beside the
 * CTA on a laptop, at most two in the phone's narrower text column — so it gets a
 * tighter cap than a card headline. 70 characters fills a desktop banner line and
 * wraps to two full lines on a phone; beyond that the reader only sees an ellipsis.
 */
export const PORTAL_BANNER_HEADLINE_MAX = 70;

/** Body text, shared by the top banner, the pop-up and the news post. */
export const PORTAL_ASSET_BODY_MAX = 300;

/**
 * The news post's subtitle (the line under the headline on its card). It is a
 * single supporting sentence, and the card clamps it to two lines on a phone, so
 * a paragraph would be lost anyway.
 */
export const PORTAL_ASSET_SUBTITLE_MAX = 120;

/** A call-to-action label — a button, never a sentence. */
export const PORTAL_ASSET_CTA_MAX = 32;

/**
 * Trim a supplied value to its cap, leaving non-strings untouched.
 *
 * The inputs already carry `maxLength`, but the API is the last line of defence:
 * an older client, a script or a stale draft could still send a longer value, and
 * the portal cards have no room for it.
 */
export function clampAssetText<T>(value: T, max: number): T | string {
  return typeof value === "string" ? value.slice(0, max) : value;
}
