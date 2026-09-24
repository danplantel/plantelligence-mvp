/**
 * Header logo band — the single source of truth for how a company / partner
 * logo is fitted into a portal header. Shared by the image editor (export crop
 * and header preview) and the rendered header itself.
 *
 * Why a shared contract: the header renders the stored logo through
 * `BrandingImage`, which pins its wrapper to the `maxHeight` it is given, and
 * the inner `<img>` is `object-contain`. The artwork's rendered height is
 * therefore
 *
 *     band * (artworkHeight / storedBoxHeight)
 *
 * so a loose (letterboxed) stored crop makes the artwork SMALLER, not larger.
 * Two consequences drive this module:
 *
 *  - the editor must export a crop that is TIGHT around the artwork, so the
 *    artwork fills the band regardless of its own aspect ratio; and
 *  - the header must use one band the editor can target. The previous
 *    per-aspect-ratio heights (76 / 83 / 90 / 98) were all clamped away by a
 *    `min(..., 48px)`, so they described a band that never existed.
 */

/**
 * The one height the logo may occupy in the header. The editor's tight export
 * guarantees the artwork actually fills this, for every artwork shape.
 */
export const HEADER_LOGO_BAND_PX = 48;

/**
 * Uniform padding added around the artwork bounds when the logo is exported, as
 * a fraction of the artwork's longer side. Enough to keep anti-aliased edges
 * from being shaved by the crop, small enough not to shrink the artwork once the
 * header fits the box into the band.
 */
export const HEADER_LOGO_OUTLINE_RATIO = 0.06;

/**
 * Widest the logo box may get, whatever its aspect ratio.
 *
 * A consequence of a tight export is that an ultra-wide wordmark now renders at
 * its true size, and a 9:1 mark at a 48px band would want ~430px of width —
 * enough to crowd the nav. Capping the box width makes `object-contain` scale
 * the whole mark down (never clip it), which is the same behaviour the old,
 * accidentally-square box produced, without shrinking ordinary logos.
 */
export const HEADER_LOGO_MAX_WIDTH_PX = 220;

/**
 * Vertical chrome the header adds around the logo band: the content wrapper's
 * `sm:py-4` (16px top + 16px bottom). Used to size the editor's header preview
 * so it is the same height as the real header.
 */
export const HEADER_BAR_CHROME_PX = 32;

/** Real rendered height of the header for a logo in the band. */
export const HEADER_LOGO_BAR_HEIGHT_PX = HEADER_LOGO_BAND_PX + HEADER_BAR_CHROME_PX;
