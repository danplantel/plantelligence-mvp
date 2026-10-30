/**
 * support-card-layout — how the "Have Questions?" support cards divide the row.
 *
 * A benefit hub shows at most four support contacts, and the row must always
 * fill its parent instead of trailing off at a fixed quarter width. The card
 * count therefore decides BOTH:
 *
 *   - the wrapper width (how many cards share the row), and
 *   - the card's element tier (how big the headshot, logo, type and CTA are).
 *
 *    1 contact  → one HALF-width card, centred. It never spans the whole row,
 *                 so a single person does not read as a banner.
 *    2 contacts → halves
 *    3 contacts → thirds from `lg` (halves on tablets, the third centred)
 *    4 contacts → quarters from `lg` (halves on tablets)
 *
 * Growing only the box would leave a 2-up card looking like a 4-up card with
 * empty space in it, so fewer contacts means a bigger tier as well.
 */

/** The most support contacts a benefit hub lists (4-up is the densest row). */
export const SUPPORT_CARD_MAX_PER_ROW = 4;

/** Element tier of the card itself. */
export type SupportCardSize = "sm" | "md" | "lg";

/** The gap between cards: 1rem on phones, 1.5rem from `sm` (see `HaveQuestions`). */
const SM_GAP_REM = 1.5;

function normalizeCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.floor(count);
}

/**
 * How many slots the `lg` row is divided into.
 *
 * A lone card is laid out as if the row held two, which is what keeps it from
 * spanning the full width. More than four cards (the data model does not
 * produce them) wrap onto another row at the quarter width.
 */
export function supportCardRowSlots(count: number): number {
  const total = normalizeCount(count);
  if (total <= 1) return 2;
  return Math.min(total, SUPPORT_CARD_MAX_PER_ROW);
}

/**
 * The element tier for a row of `count` cards:
 *
 *   4-up → `sm` (the compact card)
 *   3-up → `md`
 *   2-up and a lone card → `lg`
 *
 * Each tier scales its sizes from the phone width up, so a card is never
 * oversized on a phone just because its row holds fewer cards there.
 */
export function supportCardSize(count: number): SupportCardSize {
  const total = normalizeCount(count);
  if (total >= SUPPORT_CARD_MAX_PER_ROW) return "sm";
  if (total === 3) return "md";
  return "lg";
}

/**
 * The wrapper width class for one card.
 *
 * The wrapper — not the card — carries the column width, exactly as the
 * section always did; `min-w-0` keeps a long name from widening its column.
 * Phones stack (full width), tablets pair up (`sm`), and from `lg` the row is
 * split into `supportCardRowSlots` equal columns with 1.5rem gaps.
 */
export function supportCardColumnClass(count: number): string {
  const slots = supportCardRowSlots(count);
  const lgGapRem = SM_GAP_REM * (slots - 1);
  return [
    "w-full min-w-0",
    "sm:w-[calc((100%-1.5rem)/2)]",
    `lg:w-[calc((100%-${lgGapRem}rem)/${slots})]`,
  ].join(" ");
}
