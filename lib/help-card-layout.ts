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
 *  - One card is PRIMARY and spans 2 columns; every other card spans 1.
 *  - Because a primary takes half a row, a 7-card set fills exactly two rows:
 *      row 1: primary (2) + two standard (1 + 1)
 *      row 2: four standard (1 × 4)
 *  - The primary may sit at the LEFT or RIGHT edge of row 1 only — never between
 *    two standard cards, and never in row 2. Its edge is therefore a property of
 *    its INDEX in the stored order: 0 = left, 2 = right.
 *  - Later card sets (other benefits, added in the future) keep the same first
 *    row and wrap every subsequent four cards onto a new row.
 */

/** Row 1: the 2-wide primary plus the two standard cards beside it. */
export const HELP_CARD_ROW_1_SIZE = 3;
/** Every row after the first. */
export const HELP_CARD_ROW_SIZE = 4;

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

  const rest = storedIds.filter((id) => id !== primaryId);
  const ordered =
    side === "left"
      ? [primaryId, ...rest]
      : [...rest.slice(0, 2), primaryId, ...rest.slice(2)];

  return ordered.map((id) => (id === primaryId ? { id, primary: true } : { id }));
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

  const side = helpCardSide(entries);
  const rest = entries
    .map((entry) => entry.id)
    .filter((cardId) => cardId !== currentPrimaryId && cardId !== id);
  const insertAt = side === "left" ? 0 : Math.min(2, rest.length);
  const next = [...rest.slice(0, insertAt), id, ...rest.slice(insertAt)];

  return normalizeHelpCardLayout(next, { side, primaryId: id });
}

/** Move the primary to the other edge of row 1. */
export function setHelpCardSide(
  layout: HelpCardLayoutEntry[] | undefined | null,
  side: HelpCardSide,
): HelpCardLayoutEntry[] {
  const primaryId = helpCardPrimaryId(layout);
  return normalizeHelpCardLayout(layout, { side, primaryId });
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

  // Dropped on the primary slot → promote the dragged card, keeping the edge.
  if (overId === primaryId) {
    const moved = [...visual];
    moved.splice(to, 0, ...moved.splice(from, 1));
    return normalizeHelpCardLayout(moved, { side, primaryId: activeId });
  }

  const standards = visual.filter((id) => id !== primaryId);
  const standardFrom = standards.indexOf(activeId);
  const standardTo = standards.indexOf(overId);
  if (standardFrom < 0 || standardTo < 0) return entries;

  standards.splice(standardTo, 0, ...standards.splice(standardFrom, 1));
  return normalizeHelpCardLayout(standards, { side, primaryId });
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
 * Row 1 holds the primary plus two standard cards; every later row holds four.
 */
export function resolveHelpCardRows(
  layout: HelpCardLayoutEntry[] | undefined | null,
  category?: string | null,
): HelpCardResolved[][] {
  const catalog = helpCardCatalogFor(category);
  const entries = normalizeHelpCardLayout(layout, { catalog });

  const cards: HelpCardResolved[] = [];
  for (const entry of entries) {
    const content = getHelpCardContent(entry.id, catalog);
    if (content) cards.push({ ...content, primary: entry.primary === true });
  }

  const rows: HelpCardResolved[][] = [];
  if (cards.length > 0) rows.push(cards.slice(0, HELP_CARD_ROW_1_SIZE));
  for (let i = HELP_CARD_ROW_1_SIZE; i < cards.length; i += HELP_CARD_ROW_SIZE) {
    rows.push(cards.slice(i, i + HELP_CARD_ROW_SIZE));
  }
  return rows;
}
