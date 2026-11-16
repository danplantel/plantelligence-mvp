/**
 * iOS-style safe areas for the phone previews' screen, in REFERENCE px.
 *
 * The previews lay a page out at 390 px and then scale it down to the device's
 * visual width, so these numbers are reference px like the page's own styles —
 * not the handful of pixels they appear at.
 *
 * The device chrome rounds the screen's corners, so a page header flush with the
 * top edge had its left and right corners sliced by the curve, and the page's
 * last row lost its corners the same way. A strip of clear screen above and
 * below keeps both ends whole.
 *
 * WHERE each strip is drawn matters, and is the reason this lives in its own
 * module rather than inside a frame component:
 *
 *   - The BOTTOM strip belongs to the frame, outside the scroll container, so
 *     the page's final row stops above the bottom curve.
 *   - The TOP strip belongs to the STICKY PORTAL HEADER in the host's markup, so
 *     the notch's band and the chrome are one opaque surface pinned together.
 *     Drawn as a separate band above the scroll container instead, it left a
 *     seam the page scrolled through — you could see section content above the
 *     header as it went by.
 *
 * `EditPlanPreviewSection` and the Benefits previews (wizard Step 2, Edit
 * Benefit) draw the same device, so they read the same numbers from here.
 */
export const PREVIEW_SAFE_AREA_TOP = 26;
export const PREVIEW_SAFE_AREA_BOTTOM = 18;
