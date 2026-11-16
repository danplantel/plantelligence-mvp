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

/**
 * The gap between cards: 1rem on phones, 1.5rem from `sm` (see `HaveQuestions`).
 * The row widths below bake that 1.5rem in, because Tailwind has to read the
 * complete class name (see `LG_COLUMN_WIDTH`).
 */

function normalizeCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.floor(count);
}

/**
 * The widest row any caller may ask for.
 *
 * Five is the ceiling the layouts were checked at: "Benefits at a Glance" adds
 * the Employee Resources hub as a fifth card, and five cards of ~224–260 px
 * still read on a `lg` screen. Nothing may go denser than that.
 */
export const SUPPORT_CARD_MAX_SLOTS = 5;

/**
 * How many slots the `lg` row is divided into.
 *
 * A lone card is laid out as if the row held two, which is what keeps it from
 * spanning the full width. Cards beyond the row's capacity wrap onto another
 * row at the same column width.
 *
 * `maxSlots` lets a caller open the row wider than the support-contact default
 * of four — the landing page's benefit cards hold five when the opt-in Employee
 * Resources hub is published. It can never exceed `SUPPORT_CARD_MAX_SLOTS`.
 */
export function supportCardRowSlots(
  count: number,
  maxSlots: number = SUPPORT_CARD_MAX_PER_ROW,
): number {
  const total = normalizeCount(count);
  if (total <= 1) return 2;
  const requested = normalizeCount(maxSlots) || SUPPORT_CARD_MAX_PER_ROW;
  const cap = Math.min(Math.max(requested, 1), SUPPORT_CARD_MAX_SLOTS);
  return Math.min(total, cap);
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
 * The fields the CTA decision reads. A card draws a button only when the advisor
 * configured one AND it has a target — the same rule `SmallVerticalCard` applies,
 * so a row is levelled for a button that will actually appear.
 */
export interface SupportCtaFields {
  enableContactButton?: boolean | null;
  contactButtonType?: string | null;
  schedulingUrl?: string | null;
  websiteUrl?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** Does this support contact render a CTA button? */
export function supportContactShowsCta(
  contact: SupportCtaFields,
  appointmentLink?: string | null,
): boolean {
  if (contact.enableContactButton !== true || !contact.contactButtonType) {
    return false;
  }
  switch (contact.contactButtonType) {
    case "calendar":
      return Boolean(contact.schedulingUrl || appointmentLink);
    case "phone":
      return Boolean(contact.phone);
    case "email":
      return Boolean(contact.email);
    case "url":
      return Boolean(contact.websiteUrl);
    default:
      return false;
  }
}

/**
 * The `lg` width for a row of N cards, written out literally.
 *
 * Tailwind generates what it can READ: a class assembled with a template
 * literal (`lg:w-[calc((100%-${gap}rem)/${slots})]`) never appears in the
 * source, so no CSS was ever emitted for it — the row silently kept the `sm:`
 * half-width from `lg` up, which is why five cards stacked 2-up instead of
 * sharing one row. Each supported slot count therefore has its own string.
 *
 * Gaps are `SM_GAP_REM` (1.5rem), so N cards have N-1 of them:
 *   2 → 1.5rem · 3 → 3rem · 4 → 4.5rem · 5 → 6rem
 */
const LG_COLUMN_WIDTH: Record<number, string> = {
  2: "lg:w-[calc((100%-1.5rem)/2)]",
  3: "lg:w-[calc((100%-3rem)/3)]",
  4: "lg:w-[calc((100%-4.5rem)/4)]",
  5: "lg:w-[calc((100%-6rem)/5)]",
};

/**
 * The wrapper width class for one card.
 *
 * The wrapper — not the card — carries the column width, exactly as the
 * section always did; `min-w-0` keeps a long name from widening its column.
 * Phones stack (full width), tablets pair up (`sm`), and from `lg` the row is
 * split into `supportCardRowSlots` equal columns with 1.5rem gaps.
 */
export function supportCardColumnClass(
  count: number,
  maxSlots: number = SUPPORT_CARD_MAX_PER_ROW,
): string {
  const slots = supportCardRowSlots(count, maxSlots);
  return [
    "w-full min-w-0",
    "sm:w-[calc((100%-1.5rem)/2)]",
    LG_COLUMN_WIDTH[slots] ?? LG_COLUMN_WIDTH[2],
  ].join(" ");
}
