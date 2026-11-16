/**
 * The phone every dashboard preview draws, in one place.
 *
 * Three screens show the same device — Edit Client → Preview, Edit Client →
 * Contacts → Contact Card Layout Preview, and Create Plan Step 3 preview — and
 * at three different sizes they read as three different phones. These numbers
 * are the contract: a 200 px-wide screen at 18:9, with the page inside laid out
 * at 390 px (the width the portal's breakpoints are written for) and shrunk to
 * fit.
 *
 * The bezel adds 18 px to both dimensions (`border-[5px]` + `p-[4px]` on each
 * side), so the whole device is 218 × 418.
 */
export const PREVIEW_PHONE_WIDTH = 200;
export const PREVIEW_PHONE_REFERENCE_WIDTH = 390;
export const PREVIEW_PHONE_SCREEN_HEIGHT = 400;
/** How much the 390 px page shrinks to fit the 200 px screen. */
export const PREVIEW_PHONE_SCALE =
  PREVIEW_PHONE_WIDTH / PREVIEW_PHONE_REFERENCE_WIDTH;
/**
 * Screen height expressed in REFERENCE px — `height: 100%` for the page inside
 * the screen, so the scaled box fills it exactly (400 / 0.5128 ≈ 780).
 */
export const PREVIEW_PHONE_INNER_HEIGHT = Math.round(
  PREVIEW_PHONE_SCREEN_HEIGHT / PREVIEW_PHONE_SCALE,
);
