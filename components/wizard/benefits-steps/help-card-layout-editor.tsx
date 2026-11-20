"use client";

import { useMemo } from "react";
import { GripVertical, Loader2, Star } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { HelpCardContent, HelpCardLayoutEntry } from "@/types/benefit";
import {
  ACCOUNT_ACCESS_CARD_ID,
  fillHelpCardTokens,
  getHelpCardContent,
  helpCardCatalogFor,
} from "@/lib/help-card-defaults";
import {
  HELP_CARD_COLUMNS_OPTIONS,
  HELP_CARD_MAX_VISIBLE,
  clampHelpCards,
  helpCardMaxSpan,
  helpCardPrimaryId,
  helpCardRowSizes,
  helpCardRowSpans,
  helpCardSide,
  isHelpCardEnabled,
  moveHelpCard,
  normalizeHelpCardColumns,
  normalizeHelpCardLayout,
  setHelpCardEnabled,
  setHelpCardPrimary,
  setHelpCardSide,
  type HelpCardColumns,
} from "@/lib/help-card-layout";
import { cn } from "@/lib/utils";

interface HelpCardLayoutEditorProps {
  /** The saved layout (order + primary). Empty shows the default layout. */
  value?: HelpCardLayoutEntry[] | null;
  onChange: (layout: HelpCardLayoutEntry[]) => void;
  /**
   * The benefit being created/edited — fills `[Benefit Category]` so the cards
   * read exactly as they will on the hub ("Retirement Account Access").
   */
  category?: string;
  className?: string;
  /**
   * The cards this plan ACTUALLY has, when it is on the topic framework.
   *
   * The hub's grid is filled from the Featured placements now, and this list is
   * what brings the two views in step: the editor shows exactly those cards (plus
   * the synthesised Account Access one) and drops any stale id it still holds.
   * Omitted for a plan with no placements, which keeps the catalog behaviour.
   */
  catalog?: HelpCardContent[];
  /**
   * Whether a card can be hidden from here. Membership belongs to Quick Access
   * once the plan is on placements — promoting a question there adds a card, so a
   * second on/off switch in this list could only disagree with it.
   */
  showEnabledToggle?: boolean;
  /**
   * Whether the list can be dragged into a new order. When Quick Access owns the
   * Featured order (its ↑/↓ buttons write the placements), reordering here would
   * only make the two lists disagree — so this control picks the Primary instead.
   */
  allowReorder?: boolean;
  /**
   * How many cards share a row: 3 (the classic grid, the default) or 4. The same
   * value the portal uses, so the slot mirror below is never a different shape
   * from the page it is previewing.
   */
  columns?: number | null;
  /**
   * Change the cards-per-row choice. Omitted by a host that has nowhere to store
   * it yet — the control is then simply not drawn, rather than writing a value
   * nothing reads.
   */
  onColumnsChange?: (columns: HelpCardColumns) => void;
  /**
   * Send a card back to Quick Answers. Supplied only by a placement-driven plan:
   * a card that is not a Featured placement (Account Access) has nowhere to go,
   * so its button is not drawn. The move itself is the builder's own
   * `demoteFeaturedCard`, so both halves of the panel behave identically.
   */
  onMoveToQuickAnswers?: (cardId: string) => void;
  /** The card whose move is in flight: its button shows a spinner. */
  movingCardId?: string | null;
}

/** Column span → mini-mirror classes (a plain grid, so no breakpoint prefixes). */
const MIRROR_SPAN_CLASS: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
};

/** The mirror's own grid, which follows the chosen cards-per-row. */
const MIRROR_GRID_CLASS: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
};

/** A single visible card is three columns wide and centred, like the portal. */
const MIRROR_LONE_WIDTH: Record<number, string> = {
  3: "w-3/4",
  4: "w-3/4",
};

/**
 * ONE caption style for every control group in this editor — "Cards per row",
 * "Primary Card Positioning", "Card Layout Preview" and "Card Options" all read
 * as the same kind of heading.
 */
const CAPTION_CLASS =
  "text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

/**
 * The row and column span of every VISIBLE card, laid out with the same rule the
 * hub uses: rows divide their columns between them, so hiding a card re-flows the
 * mirror exactly as it will re-flow the portal.
 */
/**
 * Mirror tiles register under a PREFIXED id.
 *
 * The list below is its own `DndContext` over the plain card ids, and a single
 * context cannot hold two sortables with the same id — prefixing keeps the two
 * drag surfaces independent while both write the same `onChange` layout.
 */
const MIRROR_ID_PREFIX = "mirror:";

function mirrorSortableId(cardId: string): string {
  return `${MIRROR_ID_PREFIX}${cardId}`;
}

function cardIdFromMirror(sortableId: string): string {
  return sortableId.startsWith(MIRROR_ID_PREFIX)
    ? sortableId.slice(MIRROR_ID_PREFIX.length)
    : sortableId;
}

interface SortableMirrorCardProps {
  entry: HelpCardLayoutEntry;
  title: string;
  /** The quick answers builder owns the order, so this preview is read-only. */
  disabled?: boolean;
  /** The slot's own grid classes (span, or the lone card's centred width). */
  className?: string;
}

/**
 * One tile in the slot mirror.
 *
 * It is DRAGGABLE, so the advisor can re-order the cards on the shape they are
 * actually looking at instead of finding the same card in the list below. Only
 * pointer listeners are attached: the mirror is a decorative preview
 * (`aria-hidden`), and the sortable list underneath is the accessible path.
 */
function SortableMirrorCard({
  entry,
  title,
  disabled,
  className,
}: SortableMirrorCardProps) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: mirrorSortableId(entry.id),
      disabled: Boolean(disabled),
    });

  return (
    <div
      ref={setNodeRef}
      title={title}
      data-mirror-card={entry.id}
      {...(disabled ? {} : listeners)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex h-9 items-center justify-center gap-1 overflow-hidden rounded-md px-1 text-center text-[9px] font-semibold leading-tight",
        // The Primary keeps its brand fill; every other card sits a shade darker
        // than the mirror's own background, so the accent card stands out.
        entry.primary
          ? "bg-blue-600 text-white"
          : "border border-dashed border-muted-foreground/30 bg-muted text-muted-foreground shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300",
        // …and it LOOKS movable: dashed edge, grip, grab cursor, hover tint.
        !disabled &&
          "cursor-grab touch-none hover:border-blue-400 hover:text-foreground active:cursor-grabbing",
        isDragging && "relative z-10 shadow-md ring-2 ring-blue-400/70",
        className,
      )}
    >
      {!disabled && !entry.primary && (
        <GripVertical
          className="h-2.5 w-2.5 shrink-0 opacity-70"
          aria-hidden="true"
        />
      )}
      <span className="line-clamp-2">{title}</span>
    </div>
  );
}

function planCardSlots(
  visible: HelpCardLayoutEntry[],
  columns: HelpCardColumns,
): { row: number; span: number }[] {
  const slots: { row: number; span: number }[] = [];
  // The ONE-card exception: three columns wide, centred, in either grid.
  const maxSpan =
    visible.length === 1 ? 3 : helpCardMaxSpan(columns);

  let start = 0;
  let row = 1;
  for (const size of helpCardRowSizes(visible.length, columns)) {
    const rowCards = visible.slice(start, start + size);
    const primaryInRow = rowCards.findIndex((entry) => entry.primary);
    const spans = helpCardRowSpans(
      rowCards.length,
      columns,
      primaryInRow >= 0 ? primaryInRow : 0,
      maxSpan,
    );
    spans.forEach((span) => slots.push({ row, span }));
    start += size;
    row += 1;
  }

  return slots;
}

function SortableHelpCardRow({
  entry,
  index,
  isPrimary,
  category,
  catalog,
  enabled,
  showEnabledToggle = true,
  allowReorder = true,
  row = 1,
  span = 1,
  columns = 3,
  onMoveToQuickAnswers,
  moving = false,
  onMakePrimary,
  onToggleEnabled,
}: {
  entry: HelpCardLayoutEntry;
  index: number;
  isPrimary: boolean;
  category?: string;
  /** The chosen cards-per-row, for the "n/4 wide" label. */
  columns?: HelpCardColumns;
  /**
   * The CATEGORY's catalog. Reading the copy from the shared fallback would leave
   * a Retirement card titled by its id ("manage-investments") — the row must read
   * the same catalog the layout was normalized against.
   */
  catalog: HelpCardContent[];
  /** Whether the card renders on the hub (see `setHelpCardEnabled`). */
  enabled: boolean;
  /** False when Quick Access owns membership — see the editor's prop of the same name. */
  showEnabledToggle?: boolean;
  /** False when Quick Access owns the order — see the editor's prop of the same name. */
  allowReorder?: boolean;
  /** Which row the card lands in, and how many columns it takes there. */
  row?: number;
  span?: number;
  /** Present only when this card is a Featured placement. */
  onMoveToQuickAnswers?: (id: string) => void;
  /** This card's move is being written: the button shows a spinner. */
  moving?: boolean;
  onMakePrimary: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
}) {
  const content = getHelpCardContent(entry.id, catalog);
  const title = fillHelpCardTokens(content?.title ?? entry.id, category);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: entry.id,
    /**
     * Only the DRAG is ever disabled — never the drop.
     *
     * The primary must stay a drop target: dropping a standard card on it is what
     * promotes that card (`moveHelpCard`). Turning `droppable` off here made every
     * row invisible to collisions, so `over` was always null and a drop did
     * nothing at all — the reason this list could not be reordered.
     */
    disabled: isPrimary || !allowReorder ? { draggable: true } : false,
  });

  return (
    <div
      ref={setNodeRef}
      data-help-layout-card={entry.id}
      data-primary={isPrimary ? "true" : "false"}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-white p-2.5 dark:bg-gray-800",
        isPrimary
          ? "border-blue-300 ring-1 ring-blue-200 dark:border-blue-700 dark:ring-blue-900"
          : "border-muted",
        !enabled && "opacity-60",
        isDragging && "z-10 opacity-70 shadow-lg",
      )}
    >
      {/* Show/hide. Ticked by default, and the card keeps its slot while hidden,
          so unticking is always reversible. On a plan driven by placements the
          switch is absent: Quick Access is what adds and removes cards. */}
      {showEnabledToggle && (
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) =>
            onToggleEnabled(entry.id, checked === true)
          }
          aria-label={`Show ${title} on the portal`}
          data-testid={`help-card-enabled-${entry.id}`}
        />
      )}

      {/* The primary is pinned to a row-1 edge, so it has a lock instead of a
          handle. With no reordering here (Quick Access owns the order) the handle
          is left out entirely, so the row cannot look draggable when it is not. */}
      {isPrimary || !allowReorder ? (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"
          title="Primary card — change its side below, or choose another card"
        >
          <Star className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
        </span>
      ) : (
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label={`Reorder ${title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground" title={title}>
          {title}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {enabled
            ? `Row ${row} · ${span}/${columns} wide`
            : `Hidden · ${span}/${columns} wide`}
          {isPrimary ? " · Primary" : ""}
        </p>
      </div>

      {/* The builder's own demote action, offered here too. Account Access is
          synthesised from the catalog and is not a placement, so it has no row
          to move and the button is left out for it. */}
      {onMoveToQuickAnswers && entry.id !== ACCOUNT_ACCESS_CARD_ID && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 text-[11px]"
          disabled={moving}
          onClick={() => onMoveToQuickAnswers(entry.id)}
        >
          {moving && (
            <Loader2
              className="mr-1 h-3.5 w-3.5 animate-spin"
              aria-hidden="true"
            />
          )}
          Move to Quick Answers
        </Button>
      )}

      {isPrimary ? (
        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          Primary
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 text-[11px]"
          onClick={() => onMakePrimary(entry.id)}
        >
          Make primary
        </Button>
      )}
    </div>
  );
}

/**
 * The Section 4 card-layout control.
 *
 * Copy is STATIC (see `lib/help-card-defaults.ts`) — this only edits the layout:
 *  - one sortable list of all cards, so every card can be reordered, including the
 *    1/3 ones (positions 0–1 are the primary's row, 2–4 are the next one);
 *  - exactly one primary card, pinned to the LEFT or RIGHT edge of row 1, taking
 *    the widest slot in its row (2 of 3 across the full seven-card set, all 3 when
 *    a short plan leaves it alone in row 1). Dragging the primary is disabled —
 *    pick another card with "Make primary", and flip its edge with the Left/Right
 *    control.
 *
 * `lib/help-card-layout.ts` owns those rules and normalizes whatever comes back, so
 * the stored layout is always a legal 7-slot arrangement.
 */
export function HelpCardLayoutEditor({
  value,
  onChange,
  category,
  className,
  catalog: catalogProp,
  showEnabledToggle = true,
  allowReorder = true,
  columns: columnsProp,
  onColumnsChange,
  onMoveToQuickAnswers,
  movingCardId,
}: HelpCardLayoutEditorProps) {
  /** 3 or 4 cards per row — anything else in storage falls back to 3. */
  const columns = useMemo(
    () => normalizeHelpCardColumns(columnsProp),
    [columnsProp],
  );
  // The cards this plan has: the Featured placements when the host supplies them,
  // otherwise the category's OWN catalog (Retirement has its six Featured topics,
  // every other category keeps the shared set). Normalizing against it is what
  // keeps a layout from losing its cards (or gaining another category's) every
  // time it is read back — and, on a placement-driven plan, what makes a promoted
  // question appear here as soon as Quick Access saves it.
  const catalog = useMemo(
    () => catalogProp ?? helpCardCatalogFor(category),
    [catalogProp, category],
  );
  const layout = useMemo(
    () => normalizeHelpCardLayout(value, { catalog, columns }),
    [value, catalog, columns],
  );
  const primaryId = helpCardPrimaryId(layout, { catalog, columns });
  const side = helpCardSide(layout, { catalog, columns });
  // The slot mirror shows what the hub will actually render, so a hidden card
  // leaves the mirror (and its columns) behind.
  const visibleLayout = layout.filter(isHelpCardEnabled);
  // The hub paints eight cards at most, so the mirror stops there too — the
  // remaining cards stay in the list below, ready to be brought back into view.
  const mirroredLayout = clampHelpCards(visibleLayout);
  // Row + span of each visible card, so the mirror and the row labels agree with
  // what the hub will actually paint.
  const slots = planCardSlots(mirroredLayout, columns);
  const slotById = new Map(
    visibleLayout.map((entry, index) => [entry.id, slots[index]]),
  );
  // A primary that owns ALL three columns has no left/right edge to choose: it is
  // the only card on the page, so flipping the control produces the identical
  // layout. The span is read from the same slot plan the mirror draws, so the two
  // can never disagree about when the row is full.
  const primaryVisibleIndex = visibleLayout.findIndex((entry) => entry.primary);
  const primarySpan =
    primaryVisibleIndex >= 0 ? slots[primaryVisibleIndex]?.span ?? 1 : 0;
  const primaryFillsRow = primarySpan >= columns;
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange(
      moveHelpCard(layout, String(active.id), String(over.id), {
        catalog,
        columns,
      }),
    );
  };

  /**
   * The mirror's own drag: strip the prefix back to card ids and reuse the same
   * `moveHelpCard` rule, so the preview and the list can never write two
   * different layouts.
   */
  const handleMirrorDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange(
      moveHelpCard(
        layout,
        cardIdFromMirror(String(active.id)),
        cardIdFromMirror(String(over.id)),
        { catalog, columns },
      ),
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label className="text-xs font-bold text-foreground">Card Layout</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Drag a card in the preview, or in Card Options below, to reorder.
            One card is the Primary: it takes the widest slot in its row
            {primaryFillsRow
              ? ", which is the whole first row here."
              : ", at the left or right edge of row 1."}{" "}
            Dropping a card on the Primary slot makes that card the Primary.{" "}
            {showEnabledToggle
              ? "Untick a card to hide it from the portal — it keeps its place here, and the remaining cards re-fill the rows."
              : "Which cards are on the page comes from Quick Access: promote a question there to add one, or move it back to remove it. Dragging here sets the order participants see, and the Featured Cards list follows."}{" "}
            Copy is fixed per card. Either layout shows at most{" "}
            {HELP_CARD_MAX_VISIBLE} cards; with 4 across no card is wider than two
            columns.
          </p>
        </div>
        {/* Cards per row. Only drawn when the host can store the choice — a
            control that wrote nowhere would look like it did nothing. */}
        {onColumnsChange && (
          <div className="flex flex-col items-end gap-1">
            <span className={CAPTION_CLASS}>Cards per row</span>
            <div className="inline-flex overflow-hidden rounded-md border border-muted text-[11px] font-semibold">
              {HELP_CARD_COLUMNS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={columns === option}
                  aria-label={`${option} cards per row`}
                  onClick={() => onColumnsChange(option)}
                  className={cn(
                    "px-2.5 py-1.5 transition-colors",
                    columns === option
                      ? "bg-blue-600 text-white"
                      : "bg-white text-muted-foreground hover:bg-muted dark:bg-gray-800",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Where the primary sits in row 1 — only meaningful while row 1 holds
            more than one card. When the primary fills the row there is no edge
            to pick, so the control is left out entirely. */}
        {!primaryFillsRow && (
          <div className="flex flex-col items-end gap-1">
            <span className={CAPTION_CLASS}>Primary Card Positioning</span>
            <div className="inline-flex overflow-hidden rounded-md border border-muted text-[11px] font-semibold">
              {(["left", "right"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={side === option}
                  onClick={() =>
                    onChange(
                      setHelpCardSide(layout, option, { catalog, columns }),
                    )
                  }
                  className={cn(
                    "px-2.5 py-1.5 capitalize transition-colors",
                    side === option
                      ? "bg-blue-600 text-white"
                      : "bg-white text-muted-foreground hover:bg-muted dark:bg-gray-800",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* What the mirror is — and that it can be rearranged. */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className={CAPTION_CLASS}>Card Layout Preview</span>
        {allowReorder && (
          <span className={cn(CAPTION_CLASS, "inline-flex items-center gap-1")}>
            <GripVertical className="h-3 w-3" aria-hidden="true" />
            Drag to reorder
          </span>
        )}
      </div>

      {/* Slot mirror — the same shape the portal renders, and DRAGGABLE: a card
          is re-ordered on the shape it will actually take, not only by finding
          it again in the list below. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleMirrorDragEnd}
      >
        <SortableContext
          items={mirroredLayout.map((entry) => mirrorSortableId(entry.id))}
          strategy={rectSortingStrategy}
        >
          <div
            aria-hidden="true"
            data-testid="help-card-slot-preview"
            data-columns={columns}
            className={cn(
              "rounded-lg border border-muted bg-muted/20 p-2",
              mirroredLayout.length === 1
                ? "flex justify-center"
                : cn("grid gap-1.5", MIRROR_GRID_CLASS[columns]),
            )}
          >
            {mirroredLayout.length === 0 ? (
              <p
                className={cn(
                  "py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
                  MIRROR_SPAN_CLASS[columns],
                )}
              >
                All cards hidden
              </p>
            ) : (
              mirroredLayout.map((entry, index) => {
                const content = getHelpCardContent(entry.id, catalog);
                const title = fillHelpCardTokens(
                  content?.title ?? entry.id,
                  category,
                );
                return (
                  <SortableMirrorCard
                    key={entry.id}
                    entry={entry}
                    title={title}
                    // The Primary is pinned (dropping ON it promotes another
                    // card), and a plan whose order Quick Access owns cannot be
                    // re-ordered here at all.
                    disabled={!allowReorder || Boolean(entry.primary)}
                    className={
                      mirroredLayout.length === 1
                        ? MIRROR_LONE_WIDTH[columns]
                        : MIRROR_SPAN_CLASS[slots[index]?.span ?? 1]
                    }
                  />
                );
              })
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* How many cards the page actually shows, in counter form — above the list,
          where the advisor is arranging them. Hidden cards are not counted: the
          portal draws the visible ones, and eight is the cap. */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className={CAPTION_CLASS}>Card Options</span>
        <span
          data-testid="help-card-layout-count"
          className="text-[11px] font-semibold tabular-nums text-muted-foreground"
        >
          {clampHelpCards(visibleLayout).length}/{HELP_CARD_MAX_VISIBLE}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={layout.map((entry) => entry.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {layout.map((entry, index) => (
              <SortableHelpCardRow
                key={entry.id}
                entry={entry}
                index={index}
                isPrimary={entry.id === primaryId}
                category={category}
                catalog={catalog}
                enabled={isHelpCardEnabled(entry)}
                showEnabledToggle={showEnabledToggle}
                allowReorder={allowReorder}
                row={slotById.get(entry.id)?.row ?? 1}
                span={slotById.get(entry.id)?.span ?? 1}
                columns={columns}
                onMoveToQuickAnswers={onMoveToQuickAnswers}
                moving={movingCardId === entry.id}
                onMakePrimary={(id) =>
                  onChange(setHelpCardPrimary(layout, id, { catalog, columns }))
                }
                onToggleEnabled={(id, nextEnabled) =>
                  onChange(
                    // `columns` matters here too: normalizing under the wrong
                    // width would slide a right-edge primary out of slot 2.
                    setHelpCardEnabled(layout, id, nextEnabled, {
                      catalog,
                      columns,
                    }),
                  )
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
