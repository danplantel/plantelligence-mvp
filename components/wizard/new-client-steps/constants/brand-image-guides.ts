/**
 * Guide rectangle for the Featured Image cropper, in editor-canvas pixels.
 *
 * **9:10, portrait** — the shape the Featured Image is placed at: it sits beside the
 * company introduction on the hub homepage and in the card / preview placements. The
 * saved image IS the guide rectangle, so the ratio has to be expressed here, or the
 * crop and the placement disagree: a square guide exported a square image, which a
 * 9:10 placement then cropped again on its own terms.
 *
 * The WIDTH carries the reasoning; the height follows from the ratio.
 *
 *  - **396**, rather than something larger: the editor's initial fit renders an upload
 *    at 90% of the 600px canvas, and a 3:4 portrait lands at 405px wide (900x1200 →
 *    scale 0.45). A guide any wider would open the cropper already reporting "too much
 *    blank space" on the most common portrait upload.
 *  - **396 × 10/9 = 440 exactly**, so the pair is a true 9:10 with no rounding drift —
 *    which is why the height is derived rather than written out as a second literal.
 *
 * It lives in one module because THREE things crop this slot: the cropper in
 * `sections/brand-images-section.tsx` (step 1), the one in
 * `step-2-welcome-statement.tsx`, and `autoCropThumbnailImage` in
 * `sections/utils/thumbnail-utils.ts` (the gallery / upload path). While the number was
 * duplicated the three could disagree, and only one of them can be right for one slot.
 */
export const THUMBNAIL_GUIDE_WIDTH = 396;
export const THUMBNAIL_GUIDE_HEIGHT = Math.round(
  THUMBNAIL_GUIDE_WIDTH * (10 / 9),
);
