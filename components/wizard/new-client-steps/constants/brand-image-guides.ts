/**
 * Guide rectangle for the Square Thumbnail cropper, in editor-canvas pixels.
 *
 * The thumbnail slot renders in 1:1 placements across the hub, and the saved
 * image is the guide rectangle, so BOTH axes have to be the same number. A guide
 * of 400 x 450 — the values that used to be written into each call site — took a
 * portrait crop out of a slot that draws square, which the 1:1 preview then
 * letterboxed.
 *
 * It lives in one module because two croppers open on this slot: the one in
 * `sections/brand-images-section.tsx` (step 1) and the thumbnail editor in
 * `step-2-welcome-statement.tsx`. While the number was duplicated, the two could
 * disagree, and only one of them can be right for a single slot.
 *
 * 400 rather than something larger: the editor's initial fit renders an upload at
 * 90% of the 600px canvas, and a 3:4 portrait lands at 405px wide (900x1200 →
 * scale 0.45). A guide any wider would open the cropper already reporting "too
 * much blank space" on the most common portrait upload. 400 also keeps the width
 * the slot was authored with, so no existing upload gains that warning.
 */
export const THUMBNAIL_GUIDE_SIZE = 400;
