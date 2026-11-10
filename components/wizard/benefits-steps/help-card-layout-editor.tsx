"use client";

import { useMemo } from "react";
import { GripVertical, Star } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
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
  fillHelpCardTokens,
  getHelpCardContent,
  helpCardCatalogFor,
} from "@/lib/help-card-defaults";
import {
  HELP_CARD_ROW_SIZE,
  helpCardFirstRowSize,
  helpCardPrimaryId,
  helpCardRowSpans,
  helpCardSide,
  isHelpCardEnabled,
  moveHelpCard,
  normalizeHelpCardLayout,
  setHelpCardEnabled,
  setHelpCardPrimary,
  setHelpCardSide,
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
}

/** Column span → mini-mirror classes (a plain 4-column grid, so no prefixes). */
const MIRROR_SPAN_CLASS: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
};

/**
 * The row and column span of every VISIBLE card, laid out with the same rule the
 * hub uses: rows divide their four columns between them, so hiding a card re-flows
 * the mirror exactly as it will re-flow the portal.
 */
function planCardSlots(
  visible: HelpCardLayoutEntry[],
): { row: number; span: number }[] {
  const slots: { row: number; span: number }[] = [];
  const firstRowSize = helpCardFirstRowSize(visible.length);

  let start = 0;
  let row = 1;
  while (start < visible.length) {
    const size = row === 1 ? firstRowSize : HELP_CARD_ROW_SIZE;
    const rowCards = visible.slice(start, start + size);
    const primaryInRow = rowCards.findIndex((entry) => entry.primary);
    const spans = helpCardRowSpans(
      rowCards.length,
      HELP_CARD_ROW_SIZE,
      primaryInRow >= 0 ? primaryInRow : 0,
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
  row = 1,
  span = 1,
  onMakePrimary,
  onToggleEnabled,
}: {
  entry: HelpCardLayoutEntry;
  index: number;
  isPrimary: boolean;
  category?: string;
  /**
   * The CATEGORY's catalog. Reading the copy from the shared fallback would leave
   * a Retirement card titled by its id ("manage-investments") — the row must read
   * the same catalog the layout was normalized against.
   */
  catalog: HelpCardContent[];
  /** Whether the card renders on the hub (see `setHelpCardEnabled`). */
  enabled: boolean;
  /** Which row the card lands in, and how many columns it takes there. */
  row?: number;
  span?: number;
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
    // The primary cannot be dragged, but it MUST stay a drop target: dropping a
    // standard card on it is what promotes that card (see `moveHelpCard`).
    disabled: { draggable: isPrimary, droppable: false },
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
          so unticking is always reversible. */}
      <Checkbox
        checked={enabled}
        onCheckedChange={(checked) => onToggleEnabled(entry.id, checked === true)}
        aria-label={`Show ${title} on the portal`}
        data-testid={`help-card-enabled-${entry.id}`}
      />

      {/* The primary is pinned to a row-1 edge, so it has a lock instead of a handle. */}
      {isPrimary ? (
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
          {enabled ? `Row ${row} · ${span}/4 wide` : `Hidden · ${span}/4 wide`}
          {isPrimary ? " · Primary" : ""}
        </p>
      </div>

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
 *    1/4 ones (positions 0–2 are row 1, 3–6 are row 2);
 *  - exactly one primary card, pinned to the LEFT or RIGHT edge of row 1, taking
 *    the widest slot in its row (2 of 4 across the full seven-card set, all 4 when
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
}: HelpCardLayoutEditorProps) {
  // The category's OWN catalog — Retirement has its six Featured topics, every
  // other category keeps the shared set. Normalizing against it is what keeps a
  // Retirement layout from losing its cards (or gaining another category's) every
  // time it is read back.
  const catalog = useMemo(() => helpCardCatalogFor(category), [category]);
  const layout = useMemo(
    () => normalizeHelpCardLayout(value, { catalog }),
    [value, catalog],
  );
  const primaryId = helpCardPrimaryId(layout, { catalog });
  const side = helpCardSide(layout, { catalog });
  // The slot mirror shows what the hub will actually render, so a hidden card
  // leaves the mirror (and its columns) behind.
  const visibleLayout = layout.filter(isHelpCardEnabled);
  // Row + span of each visible card, so the mirror and the row labels agree with
  // what the hub will actually paint.
  const slots = planCardSlots(visibleLayout);
  const slotById = new Map(
    visibleLayout.map((entry, index) => [entry.id, slots[index]]),
  );
  // A primary that owns ALL four columns has no left/right edge to choose: it is
  // the only card in row 1 (1, 5, 9… visible cards), so flipping the control
  // produces the identical layout. The span is read from the same slot plan the
  // mirror draws, so the two can never disagree about when the row is full.
  const primaryVisibleIndex = visibleLayout.findIndex((entry) => entry.primary);
  const primarySpan =
    primaryVisibleIndex >= 0 ? slots[primaryVisibleIndex]?.span ?? 1 : 0;
  const primaryFillsRow = primarySpan >= HELP_CARD_ROW_SIZE;
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
      moveHelpCard(layout, String(active.id), String(over.id), { catalog }),
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label className="text-xs font-bold text-foreground">Card Layout</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Drag to reorder. One card is the Primary: it takes the widest slot in
            its row
            {primaryFillsRow
              ? ", which is the whole first row here."
              : ", at the left or right edge of row 1."}{" "}
            Dropping a card on the Primary slot makes that card the Primary.
            Untick a card to hide it from the portal — it keeps its place here,
            and the remaining cards re-fill the rows. Copy is fixed per card.
          </p>
        </div>
        {/* Where the primary sits in row 1 — only meaningful while row 1 holds
            more than one card. When the primary fills the row there is no edge
            to pick, so the control is left out entirely. */}
        {!primaryFillsRow && (
          <div className="inline-flex overflow-hidden rounded-md border border-muted text-[11px] font-semibold">
            {(["left", "right"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={side === option}
                onClick={() =>
                  onChange(setHelpCardSide(layout, option, { catalog }))
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
        )}
      </div>

      {/* 4-column slot mirror — the same shape the portal renders. */}
      <div
        aria-hidden="true"
        data-testid="help-card-slot-preview"
        className="grid grid-cols-4 gap-1.5 rounded-lg border border-muted bg-muted/20 p-2"
      >
        {visibleLayout.length === 0 ? (
          <p className="col-span-4 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            All cards hidden
          </p>
        ) : (
          visibleLayout.map((entry, index) => {
            const content = getHelpCardContent(entry.id, catalog);
            const title = fillHelpCardTokens(
              content?.title ?? entry.id,
              category,
            );
            return (
              <div
                key={entry.id}
                title={title}
                className={cn(
                  "flex h-9 items-center justify-center overflow-hidden rounded-md px-1 text-center text-[9px] font-semibold leading-tight",
                  MIRROR_SPAN_CLASS[slots[index]?.span ?? 1],
                  entry.primary
                    ? "bg-blue-600 text-white"
                    : "bg-white text-muted-foreground dark:bg-gray-800",
                )}
              >
                <span className="line-clamp-2">{title}</span>
              </div>
            );
          })
        )}
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
                row={slotById.get(entry.id)?.row ?? 1}
                span={slotById.get(entry.id)?.span ?? 1}
                onMakePrimary={(id) =>
                  onChange(setHelpCardPrimary(layout, id, { catalog }))
                }
                onToggleEnabled={(id, nextEnabled) =>
                  onChange(
                    setHelpCardEnabled(layout, id, nextEnabled, { catalog }),
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
