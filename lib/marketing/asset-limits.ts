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

/** Body text, shared by the top banner, the pop-up and the news post. */
export const PORTAL_ASSET_BODY_MAX = 300;
