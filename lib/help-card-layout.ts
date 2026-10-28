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
 *  - The grid is 4 columns wide.
 *  - One card is PRIMARY and takes the widest slot in its row; the rest of the
 *    row's cards fill whatever is left, so EVERY row reaches the right edge.
 *    No row is ever left with an empty column — the section must not paint white
 *    space just because a plan shows fewer cards than the catalog does.
 *  - With the 7-card catalog that still reads exactly as it always has:
 *      row 1: primary (2) + two standard (1 + 1)
 *      row 2: four standard (1 × 4)
 *  - A shorter set re-balances instead of trailing off. Five cards put the
 *    primary alone across the whole first row and the other four beneath it;
 *    six cards give a two-card first row over a four-card second row.
 *  - The primary may sit at the LEFT or RIGHT edge of row 1 only — never between
 *    two standard cards, and never in row 2. Its edge is therefore a property of
 *    its INDEX in the stored order: 0 = left, 2 = right.
 */

/**
 * Row 1 of the classic 7-card set: the 2-wide primary plus the two standard cards
 * beside it. Kept for the layout editor's row labels — the portal itself derives
 * the first row's size from the card count with [`helpCardFirstRowSize`].
 */
export const HELP_CARD_ROW_1_SIZE = 3;
/** How many columns the grid has, and the size of every row after the first. */
export const HELP_CARD_ROW_SIZE = 4;

/**
 * How many cards share the FIRST row.
 *
 * Packing greedily from the front leaves the *last* row short — the white space
 * this layout exists to avoid — so the first row takes the remainder instead and
 * every later row is a full four:
 *
 *   7 cards → 3 + 4       (primary + two, then four)
 *   5 cards → 1 + 4       (the primary gets the whole first row)
 *   6 cards → 2 + 4
 *   4 cards → 4
 *   8 cards → 4 + 4
 *   9 cards → 1 + 4 + 4
 */
export function helpCardFirstRowSize(cardCount: number): number {
  if (cardCount <= 0) return 0;
  const remainder = cardCount % HELP_CARD_ROW_SIZE;
  return remainder === 0 ? HELP_CARD_ROW_SIZE : remainder;
}

/**
 * The column span of each card in a row of `rowSize`, adding up to the grid's
 * four columns:
 *
 *   1 card  → [4]
 *   2 cards → [2, 2]
 *   3 cards → [2, 1, 1]
 *   4 cards → [1, 1, 1, 1]
 *
 * `emphasisIndex` is the row's PRIMARY. The extra columns are handed out from
 * there first, so a primary at the RIGHT edge of row 1 is still the wide card
 * (`[1, 1, 2]`) — the emphasis follows the card, not the slot.
 */
export function helpCardRowSpans(
  rowSize: number,
  columns: number = HELP_CARD_ROW_SIZE,
  emphasisIndex = 0,
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
  return spans;
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
): HelpCardLayoutEntry[] {
  const rest = ids.filter((id) => id !== primaryId);
  const ordered =
    side === "left"
      ? [primaryId, ...rest]
      : [...rest.slice(0, 2), primaryId, ...rest.slice(2)];

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
 *  - The primary is placed at index 0 (left) or index 2 (right) — the only two
 *    legal slots. Copy is stripped: only `id`/`primary` are persisted.
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
  // one. The canonical slots are 0 (left) and 2 (right); a primary at index 1 is
  // treated as left, and anything past index 2 as right.
  const storedIndex = stored.findIndex((entry) => entry.id === primaryId);
  const side: HelpCardSide =
    options.side ?? (storedIndex >= 2 ? "right" : "left");

  return arrangeHelpCards(storedIds, primaryId, side, disabledIdsOf(stored));
}

/** Which edge of row 1 the primary occupies. */
export function helpCardSide(
  layout: HelpCardLayoutEntry[] | undefined | null,
): HelpCardSide {
  const entries = normalizeHelpCardLayout(layout);
  return entries.findIndex((entry) => entry.primary) === 0 ? "left" : "right";
}

/** The primary card id. */
export function helpCardPrimaryId(
  layout: HelpCardLayoutEntry[] | undefined | null,
): string {
  const entries = normalizeHelpCardLayout(layout);
  return entries.find((entry) => entry.primary)?.id ?? entries[0]?.id ?? "";
}

/** Make `id` the primary, keeping the current edge. */
export function setHelpCardPrimary(
  layout: HelpCardLayoutEntry[] | undefined | null,
  id: string,
): HelpCardLayoutEntry[] {
  const entries = normalizeHelpCardLayout(layout);
  const currentPrimaryId = helpCardPrimaryId(entries);
  if (!id || id === currentPrimaryId) return entries;
  if (!entries.some((entry) => entry.id === id)) return entries;

  return arrangeHelpCards(
    entries.map((entry) => entry.id),
    id,
    helpCardSide(entries),
    disabledIdsOf(entries),
  );
}

/** Move the primary to the other edge of row 1. */
export function setHelpCardSide(
  layout: HelpCardLayoutEntry[] | undefined | null,
  side: HelpCardSide,
): HelpCardLayoutEntry[] {
  const entries = normalizeHelpCardLayout(layout);
  return arrangeHelpCards(
    entries.map((entry) => entry.id),
    helpCardPrimaryId(entries),
    side,
    disabledIdsOf(entries),
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
): HelpCardLayoutEntry[] {
  const entries = normalizeHelpCardLayout(layout);
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
): HelpCardLayoutEntry[] {
  const entries = normalizeHelpCardLayout(layout);
  const primaryId = helpCardPrimaryId(entries);
  if (!activeId || !overId || activeId === overId) return entries;
  if (activeId === primaryId) return entries;

  const side = helpCardSide(entries);
  const visual = entries.map((entry) => entry.id);
  const from = visual.indexOf(activeId);
  const to = visual.indexOf(overId);
  if (from < 0 || to < 0) return entries;

  const disabled = disabledIdsOf(entries);

  // Dropped on the primary slot → promote the dragged card, keeping the edge.
  if (overId === primaryId) {
    return arrangeHelpCards(visual, activeId, side, disabled);
  }

  const standards = visual.filter((id) => id !== primaryId);
  const standardFrom = standards.indexOf(activeId);
  const standardTo = standards.indexOf(overId);
  if (standardFrom < 0 || standardTo < 0) return entries;

  standards.splice(standardTo, 0, ...standards.splice(standardFrom, 1));
  return arrangeHelpCards(standards, primaryId, side, disabled);
}

/**
 * The final card order for a layout, with the primary pinned to its edge.
 * Positions 0–2 are row 1; 3–6 are row 2.
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
 * Row sizes come from [`helpCardFirstRowSize`], so the last row is always a full
 * four and no column is left empty. With the 7-card catalog that is the familiar
 * primary + two, then four. If the primary itself is hidden there is no wide card
 * to lay out around, so the remaining cards simply pack four to a row.
 */
export function resolveHelpCardRows(
  layout: HelpCardLayoutEntry[] | undefined | null,
  category?: string | null,
): HelpCardResolved[][] {
  const catalog = helpCardCatalogFor(category);
  const entries = normalizeHelpCardLayout(layout, { catalog });

  const cards: HelpCardResolved[] = [];
  for (const entry of entries) {
    if (!isHelpCardEnabled(entry)) continue;
    const content = getHelpCardContent(entry.id, catalog);
    if (content) cards.push({ ...content, primary: entry.primary === true });
  }

  const rows: HelpCardResolved[][] = [];
  const hasPrimary = cards.some((card) => card.primary);
  if (!hasPrimary) {
    for (let i = 0; i < cards.length; i += HELP_CARD_ROW_SIZE) {
      rows.push(cards.slice(i, i + HELP_CARD_ROW_SIZE));
    }
    return rows;
  }

  const firstRowSize = helpCardFirstRowSize(cards.length);
  if (firstRowSize > 0) rows.push(cards.slice(0, firstRowSize));
  for (let i = firstRowSize; i < cards.length; i += HELP_CARD_ROW_SIZE) {
    rows.push(cards.slice(i, i + HELP_CARD_ROW_SIZE));
  }
  return rows;
}
