import {
  ACCOUNT_ACCESS_CARD_ID,
  HELP_CARD_CATALOG,
  getHelpCardContent,
  helpCardCatalogFor,
} from "@/lib/help-card-defaults";
import type {
  HelpCardContent,
  HelpCardLayoutEntry,
  HelpCardResolved,
} from "@/types/benefit";

/**
 * The "How Can We Help You Today?" layout rules.
 *
 *  - The grid is 3 columns wide.
 *  - One card is PRIMARY and takes the widest slot in its row; the rest of the
 *    row's cards fill whatever is left, so EVERY row reaches the right edge.
 *    No row is ever left with an empty column — the section must not paint white
 *    space just because a plan shows fewer cards than the catalog does.
 *  - Row 1 is the PRIMARY's row: it takes two of the three columns at its chosen
 *    edge and one standard card fills the third. Three equal thirds would leave
 *    the primary with no wider slot than its neighbours, so the primary's row is
 *    the one row that holds two. Every later row holds three.
 *  - With the 7-card catalog that reads:
 *      row 1: primary (2) + one standard (1)
 *      row 2: three standard (1 × 3)
 *      row 3: two standard (2 + 1)
 *  - A shorter set re-balances instead of trailing off. Whatever lands in a short
 *    final row widens to fill it (see [`helpCardRowSpans`]), and a lone card spans
 *    the whole row.
 *  - The primary may sit at the LEFT or RIGHT edge of row 1 only — never between
 *    two standard cards, and never in a later row. Its edge is therefore a
 *    property of its INDEX in the stored order: 0 = left, 1 = right.
 */

/**
 * Row 1 of the classic 7-card set: the 2-wide primary plus the one standard card
 * beside it. Kept for the layout editor's row labels — the portal itself derives
 * the first row's size from the card count with [`helpCardFirstRowSize`].
 */
export const HELP_CARD_ROW_1_SIZE = 2;
/** How many columns the grid has by default, and the size of every row after the first. */
export const HELP_CARD_ROW_SIZE = 3;

/**
 * The "cards per row" choices offered in the Card Layout editor.
 *
 * 3 is the classic grid (the Primary takes two of the three columns); 4 is the
 * denser one. A stored value that is neither falls back to 3, so a legacy row —
 * or a bad payload — can never produce a grid the renderer does not know.
 */
export const HELP_CARD_COLUMNS_OPTIONS = [3, 4] as const;
export type HelpCardColumns = (typeof HELP_CARD_COLUMNS_OPTIONS)[number];
export const HELP_CARD_DEFAULT_COLUMNS: HelpCardColumns = 3;

/** A stored column count → the only two values the grid can draw. */
export function normalizeHelpCardColumns(value: unknown): HelpCardColumns {
  const parsed = typeof value === "number" ? value : Number(value);
  return parsed === 4 ? 4 : 3;
}

/**
 * The widest a single card may be: TWO columns, in either grid.
 *
 * No row may contain a card that runs the full length of that row — the Primary
 * included — so the 3-column grid caps at 2 as well. A lone card is the one case
 * that cannot fill its row (3 needs a 3-wide card); it stays 2 wide rather than
 * becoming a banner.
 */
export function helpCardMaxSpan(
  _columns: HelpCardColumns = HELP_CARD_DEFAULT_COLUMNS,
): number {
  return 2;
}

/**
 * The most cards the grid shows.
 *
 * Eight is the largest set the three-column grid fills exactly — the primary's row
 * of two plus two full rows of three — so the section never ends on a card
 * stranded across a row of its own. Quick Access can promote any number of
 * questions onto the hub, so a longer list is trimmed to its first eight: the
 * order the advisor arranged.
 */
export const HELP_CARD_MAX_VISIBLE = 8;

/** Trim a card list to the most the grid shows (see [`HELP_CARD_MAX_VISIBLE`]). */
export function clampHelpCards<T>(cards: readonly T[]): T[] {
  return cards.slice(0, HELP_CARD_MAX_VISIBLE);
}

/**
 * How many cards share the FIRST row.
 *
 * Row 1 belongs to the PRIMARY: it takes two columns at its edge and standard
 * cards fill the rest of the row, which is what keeps a card visibly the wide
 * one. Every later row holds `columns` cards, and a short final row widens the
 * cards it does hold instead of trailing off short of the right edge.
 *
 * 3 columns (the default):
 *   1 card  → 1           (the primary owns the row: all three columns)
 *   2 cards → 2           (primary + one)
 *   3 cards → 2 + 1
 *   … later rows of 3
 *
 * 4 columns (no card may exceed two columns):
 *   1 card  → 1           (primary, 2 of 4 — the rest of the row stays empty)
 *   2 cards → 2           (primary + one, each 2 of 4)
 *   3 cards → 2 + 1 + 1
 *   … later rows of 4
 */
export function helpCardFirstRowSize(
  cardCount: number,
  columns: HelpCardColumns = HELP_CARD_DEFAULT_COLUMNS,
): number {
  if (cardCount <= 0) return 0;
  // The primary owns two columns, so the rest of its row holds `columns - 2`
  // standard cards — i.e. `columns - 1` cards in total.
  return Math.min(cardCount, Math.max(1, columns - 1));
}

/**
 * How many cards sit in each row, top to bottom.
 *
 * The default is the Primary's row (`columns - 1` cards) followed by full rows
 * of `columns`. The 4-across grid has ONE deliberate exception: a FULL page of
 * eight cards reads as two rows of two half-width cards and then one row of
 * four — `2+2 / 2+2 / 1+1+1+1`, i.e. the first four cards are each two columns
 * wide. Seven or fewer keep the Primary-row packing.
 *
 * Shared by the portal, the editor's slot mirror and the layout math, so the
 * three can never disagree about where a row breaks.
 */
export function helpCardRowSizes(
  count: number,
  columns: HelpCardColumns = HELP_CARD_DEFAULT_COLUMNS,
): number[] {
  if (count <= 0) return [];
  if (columns === 4 && count === HELP_CARD_MAX_VISIBLE) {
    return [2, 2, HELP_CARD_MAX_VISIBLE - 4];
  }
  const sizes = [helpCardFirstRowSize(count, columns)];
  let remaining = count - sizes[0];
  while (remaining > 0) {
    const size = Math.min(columns, remaining);
    sizes.push(size);
    remaining -= size;
  }

  /**
   * A trailing row of ONE would leave an unfillable single card, so the last two
   * rows are re-balanced together — every row then reaches the right edge:
   *
   *   columns 4, 4 cards:  [3, 1] → [2, 2]   (four 2-wide cards, as asked)
   *   columns 3, 6 cards:  [2, 3, 1] → [2, 2, 2]
   *   columns 3, 3 cards:  [2, 1] → [3]      (one full row of three 1-wide cards)
   */
  if (sizes.length > 1 && sizes[sizes.length - 1] === 1) {
    const combined = sizes[sizes.length - 2] + 1;
    sizes.splice(sizes.length - 2, 2);
    if (combined === 4 && columns === 4) {
      // The advisor's own example: four cards, four columns, all 2 wide.
      sizes.push(2, 2);
    } else if (combined <= columns) {
      // The pair fits one row, and it is then FULL by definition.
      sizes.push(combined);
    } else {
      // Two rows of halves, so neither row ends with a lone card.
      const half = Math.ceil(combined / 2);
      sizes.push(half, combined - half);
    }
  }
  return sizes;
}

/**
 * The column span of each card in a row of `rowSize`, adding up to the grid's
 * three columns:
 *
 *   1 card  → [3]
 *   2 cards → [2, 1]
 *   3 cards → [1, 1, 1]
 *
 * `emphasisIndex` is the row's PRIMARY. The extra column is handed out from
 * there first, so a primary at the RIGHT edge of row 1 is still the wide card
 * (`[1, 2]`) — the emphasis follows the card, not the slot.
 */
export function helpCardRowSpans(
  rowSize: number,
  columns: HelpCardColumns = HELP_CARD_DEFAULT_COLUMNS,
  emphasisIndex = 0,
  maxSpan: number = columns,
): number[] {
  if (rowSize <= 0) return [];
  // A row never holds more cards than the grid has columns; clamping keeps the
  // spans at 1 or more if a caller ever hands us more.
  const size = Math.min(rowSize, columns);
  const base = Math.floor(columns / size);
  const remainder = columns % size;
  const spans = Array.from({ length: size }, () => base);
  for (let offset = 0; offset < remainder; offset += 1) {
    const index = (emphasisIndex + offset) % size;
    spans[index] += 1;
  }
  // The 4-column grid caps every card at two columns, so a lone card in a short
  // row keeps the row half empty instead of becoming a banner.
  return spans.map((span) => Math.min(span, maxSpan));
}

export type HelpCardSide = "left" | "right";

/** A persisted entry, tolerating legacy rows that stored the full card object. */
type StoredEntry = Partial<HelpCardLayoutEntry> & { id?: string };

export interface NormalizeHelpCardOptions {
  /** Card catalog to resolve against (defaults to the hub set). */
  catalog?: HelpCardContent[];
  /** Force the primary to this edge of row 1. */
  side?: HelpCardSide;
  /** Force this card to be the primary (the stored flags are otherwise used). */
  primaryId?: string;
  /**
   * The grid width, because the primary's RIGHT-edge slot depends on it: row 1
   * holds `columns - 1` cards, so "right" is index 1 with 3 across and index 2
   * with 4 across. Defaults to 3.
   */
  columns?: HelpCardColumns;
}

function readStoredEntries(entries: unknown): StoredEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    // A bare id list is accepted too: the layout helpers pass ids around
    // internally, and older callers may have stored `["savings", …]`.
    .map((entry) => (typeof entry === "string" ? { id: entry } : entry))
    .filter(
      (entry): entry is StoredEntry =>
        !!entry && typeof entry === "object" && !Array.isArray(entry),
    );
}

/** The ids stored as `enabled: false` (a absent flag means enabled). */
function disabledIdsOf(entries: StoredEntry[]): Set<string> {
  const disabled = new Set<string>();
  for (const entry of entries) {
    if (entry.enabled === false && typeof entry.id === "string") {
      disabled.add(entry.id);
    }
  }
  return disabled;
}

/**
 * Lay the cards out with `primaryId` at the requested edge of row 1, re-emitting
 * only the persisted flags.
 *
 * Every rule below goes through this function, which is what keeps a hidden card
 * hidden: `enabled: false` travels with its id through promotion, side flips and
 * drag-reordering instead of being dropped by a rebuilt id list.
 */
function arrangeHelpCards(
  ids: string[],
  primaryId: string,
  side: HelpCardSide,
  disabled: Set<string>,
  columns: HelpCardColumns = HELP_CARD_DEFAULT_COLUMNS,
): HelpCardLayoutEntry[] {
  const rest = ids.filter((id) => id !== primaryId);
  // The right edge is the last slot of row 1 — whose size the packing rule
  // decides (a full 4-across page puts just two cards there).
  const row1Slots = helpCardRowSizes(ids.length, columns)[0] ?? 1;
  const rightAt = Math.min(Math.max(row1Slots - 1, 1), rest.length);
  const ordered =
    side === "left"
      ? [primaryId, ...rest]
      : [...rest.slice(0, rightAt), primaryId, ...rest.slice(rightAt)];

  return ordered.map((id) => {
    const entry: HelpCardLayoutEntry = { id };
    if (id === primaryId) entry.primary = true;
    if (disabled.has(id)) entry.enabled = false;
    return entry;
  });
}

/**
 * Coerce any stored value into the canonical 7-entry layout.
 *
 *  - Unknown / duplicate ids are dropped; catalog ids missing from the stored
 *    layout are appended, so a plan always renders every card exactly once.
 *  - Exactly one card is marked primary. With no flag the catalog default
 *    (Account Access) wins, which also upgrades legacy rows.
 *  - The primary is placed at index 0 (left) or index 1 (right) — the only two
 *    legal slots, because row 1 holds the primary plus one standard card. Copy is
 *    stripped: only `id`/`primary` are persisted.
 */
export function normalizeHelpCardLayout(
  entries?: unknown,
  options: NormalizeHelpCardOptions = {},
): HelpCardLayoutEntry[] {
  const catalog = options.catalog ?? HELP_CARD_CATALOG;
  const catalogIds = catalog.map((card) => card.id);
  const known = new Set(catalogIds);

  const stored = readStoredEntries(entries);
  const storedIds: string[] = [];
  let storedPrimaryId = "";

  for (const entry of stored) {
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!id || !known.has(id) || storedIds.includes(id)) continue;
    storedIds.push(id);
    if (!storedPrimaryId && entry.primary === true) storedPrimaryId = id;
  }
  // Ids the plan actually saved. A catalog card that is NEW to this layout (or a
  // card the catalog ships hidden) follows its catalog default; a card the plan
  // chose keeps whatever the plan stored.
  const chosenIds = [...storedIds];
  for (const id of catalogIds) {
    if (!storedIds.includes(id)) storedIds.push(id);
  }

  const defaultPrimaryId = known.has(ACCOUNT_ACCESS_CARD_ID)
    ? ACCOUNT_ACCESS_CARD_ID
    : catalogIds[0];
  const primaryId =
    (options.primaryId && known.has(options.primaryId)
      ? options.primaryId
      : "") ||
    storedPrimaryId ||
    defaultPrimaryId;

  // Where the primary currently sits decides its edge, unless the caller forces
  // one. Row 1 holds `columns - 1` cards, so its right edge is slot 1 with 3
  // across and slot 2 with 4; the left edge is always slot 0.
  const columns = options.columns ?? HELP_CARD_DEFAULT_COLUMNS;
  const row1Slots = helpCardRowSizes(storedIds.length, columns)[0] ?? 1;
  const rightEdge = Math.max(row1Slots - 1, 1);
  const storedIndex = stored.findIndex((entry) => entry.id === primaryId);
  const side: HelpCardSide =
    options.side ?? (storedIndex >= rightEdge ? "right" : "left");

  const disabled = disabledIdsOf(stored);
  for (const card of catalog) {
    if (card.defaultEnabled === false && !chosenIds.includes(card.id)) {
      disabled.add(card.id);
    }
  }

  return arrangeHelpCards(storedIds, primaryId, side, disabled, columns);
}

/**
 * Which edge of row 1 the primary occupies.
 *
 * `options.catalog` selects the category's card set; without it the shared
 * fallback catalog is used, exactly as before.
 */
export function helpCardSide(
  layout: HelpCardLayoutEntry[] | undefined | null,
  options: NormalizeHelpCardOptions = {},
): HelpCardSide {
  const entries = normalizeHelpCardLayout(layout, options);
  return entries.findIndex((entry) => entry.primary) === 0 ? "left" : "right";
}

/** The primary card id. */
export function helpCardPrimaryId(
  layout: HelpCardLayoutEntry[] | undefined | null,
  options: NormalizeHelpCardOptions = {},
): string {
  const entries = normalizeHelpCardLayout(layout, options);
  return entries.find((entry) => entry.primary)?.id ?? entries[0]?.id ?? "";
}

/** Make `id` the primary, keeping the current edge. */
export function setHelpCardPrimary(
  layout: HelpCardLayoutEntry[] | undefined | null,
  id: string,
  options: NormalizeHelpCardOptions = {},
): HelpCardLayoutEntry[] {
  const entries = normalizeHelpCardLayout(layout, options);
  const currentPrimaryId = helpCardPrimaryId(entries, options);
  if (!id || id === currentPrimaryId) return entries;
  if (!entries.some((entry) => entry.id === id)) return entries;

  return arrangeHelpCards(
    entries.map((entry) => entry.id),
    id,
    helpCardSide(entries, options),
    disabledIdsOf(entries),
    options.columns,
  );
}

/** Move the primary to the other edge of row 1. */
export function setHelpCardSide(
  layout: HelpCardLayoutEntry[] | undefined | null,
  side: HelpCardSide,
  options: NormalizeHelpCardOptions = {},
): HelpCardLayoutEntry[] {
  const entries = normalizeHelpCardLayout(layout, options);
  return arrangeHelpCards(
    entries.map((entry) => entry.id),
    helpCardPrimaryId(entries, options),
    side,
    disabledIdsOf(entries),
    options.columns,
  );
}

/**
 * Show or hide one card.
 *
 * The card keeps its slot, so hiding and re-showing it is reversible — the order
 * and the primary flag are untouched.
 */
export function setHelpCardEnabled(
  layout: HelpCardLayoutEntry[] | undefined | null,
  id: string,
  enabled: boolean,
  options: NormalizeHelpCardOptions = {},
): HelpCardLayoutEntry[] {
  const entries = normalizeHelpCardLayout(layout, options);
  if (!entries.some((entry) => entry.id === id)) return entries;

  return entries.map((entry) => {
    if (entry.id !== id) return entry;
    const next: HelpCardLayoutEntry = { id: entry.id };
    if (entry.primary) next.primary = true;
    if (!enabled) next.enabled = false;
    return next;
  });
}

/** Whether a card renders on the hub (absent flag = enabled). */
export function isHelpCardEnabled(
  entry: HelpCardLayoutEntry | undefined | null,
): boolean {
  return entry?.enabled !== false;
}

/**
 * Reorder the cards.
 *
 *  - The primary itself cannot be dragged (there is nothing to swap it with).
 *  - Dropping a standard card ON the primary makes THAT card primary, at the same
 *    edge of row 1; the previous primary slides into the dropped card's old place.
 *    This is the drag equivalent of "Make primary".
 *  - Any other move reorders the standard cards around the pinned primary, across
 *    the row-1/row-2 boundary.
 */
export function moveHelpCard(
  layout: HelpCardLayoutEntry[] | undefined | null,
  activeId: string,
  overId: string,
  options: NormalizeHelpCardOptions = {},
): HelpCardLayoutEntry[] {
  const entries = normalizeHelpCardLayout(layout, options);
  const primaryId = helpCardPrimaryId(entries, options);
  if (!activeId || !overId || activeId === overId) return entries;
  if (activeId === primaryId) return entries;

  const side = helpCardSide(entries, options);
  const visual = entries.map((entry) => entry.id);
  const from = visual.indexOf(activeId);
  const to = visual.indexOf(overId);
  if (from < 0 || to < 0) return entries;

  const disabled = disabledIdsOf(entries);

  // Dropped on the primary slot → promote the dragged card, keeping the edge.
  if (overId === primaryId) {
    return arrangeHelpCards(visual, activeId, side, disabled, options.columns);
  }

  const standards = visual.filter((id) => id !== primaryId);
  const standardFrom = standards.indexOf(activeId);
  const standardTo = standards.indexOf(overId);
  if (standardFrom < 0 || standardTo < 0) return entries;

  standards.splice(standardTo, 0, ...standards.splice(standardFrom, 1));
  return arrangeHelpCards(standards, primaryId, side, disabled, options.columns);
}

/**
 * The final card order for a layout, with the primary pinned to its edge.
 * Positions 0–1 are the primary's row; 2–4 are the next row, and so on.
 */
export function helpCardVisualOrder(
  layout: HelpCardLayoutEntry[] | undefined | null,
): HelpCardLayoutEntry[] {
  return normalizeHelpCardLayout(layout);
}

/** The default layout: every catalog card, Account Access primary on the left. */
export function defaultHelpCardLayout(
  category?: string | null,
): HelpCardLayoutEntry[] {
  return normalizeHelpCardLayout(undefined, {
    catalog: helpCardCatalogFor(category),
  });
}

/**
 * Resolve the layout into rows of cards carrying their static copy.
 *
 * Only ENABLED cards are returned — a card the advisor unticked in the Editing
 * Panel does not reach the hub at all.
 *
 * Row sizes come from [`helpCardFirstRowSize`], so the primary's row holds two
 * and every later row holds three; a short last row widens the cards it holds so
 * no column is left empty. With the 7-card catalog that is the primary + one,
 * then three, then two. If the primary itself is hidden there is no wide card to
 * lay out around, so the remaining cards simply pack three to a row.
 */
export function resolveHelpCardRows(
  layout: HelpCardLayoutEntry[] | undefined | null,
  category?: string | null,
  columns: HelpCardColumns = HELP_CARD_DEFAULT_COLUMNS,
): HelpCardResolved[][] {
  const catalog = helpCardCatalogFor(category);
  const entries = normalizeHelpCardLayout(layout, { catalog, columns });

  const cards: HelpCardResolved[] = [];
  for (const entry of entries) {
    if (!isHelpCardEnabled(entry)) continue;
    const content = getHelpCardContent(entry.id, catalog);
    if (content) cards.push({ ...content, primary: entry.primary === true });
  }

  // The grid shows at most eight cards, so a plan that features more simply
  // shows the first eight of them.
  const visible = clampHelpCards(cards);

  const rows: HelpCardResolved[][] = [];
  const hasPrimary = visible.some((card) => card.primary);
  if (!hasPrimary) {
    // No wide card to lay out around: the remaining cards simply pack
    // `columns` to a row.
    for (let i = 0; i < visible.length; i += columns) {
      rows.push(visible.slice(i, i + columns));
    }
    return rows;
  }

  let start = 0;
  for (const size of helpCardRowSizes(visible.length, columns)) {
    rows.push(visible.slice(start, start + size));
    start += size;
  }
  return rows;
}
