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
 * It lives in one module because more than one thing crops this slot: the cropper in
 * `sections/brand-images-section.tsx` (Edit Plan / Edit Benefit), the one in
 * `step-2-welcome-statement.tsx` (Create Plan), and `autoCropThumbnailImage` in
 * `sections/utils/thumbnail-utils.ts`, which crops an image the user did not frame in
 * the editor. While the number was duplicated these could disagree, and only one of
 * them can be right for one slot.
 *
 * Every one of them exports at `THUMBNAIL_RECOMMENDED_*` (below), not at the guide
 * size: the guide is only the on-screen frame, and a crop saved at frame size was
 * smaller than the default image it replaced.
 */
export const THUMBNAIL_GUIDE_WIDTH = 396;
export const THUMBNAIL_GUIDE_HEIGHT = Math.round(
  THUMBNAIL_GUIDE_WIDTH * (10 / 9),
);

/**
 * The slot's recommended pixel size — what the "Recommended: 900×1000 px" label
 * promises, and therefore what a crop has to be exported at. A crop saved at the
 * frame size (396×440) replaced a 900×1000 default image, so it rendered visibly
 * smaller and softer than the image the advisor had just replaced.
 */
export const THUMBNAIL_RECOMMENDED_WIDTH = 900;
export const THUMBNAIL_RECOMMENDED_HEIGHT = Math.round(
  THUMBNAIL_RECOMMENDED_WIDTH * (10 / 9),
);

/**
 * What the croppers pass as `exportScale`.
 *
 * The on-screen frame has to stay small (see above), so the crop is rendered up to
 * the recommended size at export time instead: `exportScale` multiplies the guide
 * rectangle, giving 900×1000 rather than 396×440. The height follows the width, so
 * the exported pair is exactly 900×1000 — a true 9:10, same as the guide.
 */
export const THUMBNAIL_EXPORT_SCALE =
  THUMBNAIL_RECOMMENDED_WIDTH / THUMBNAIL_GUIDE_WIDTH;
