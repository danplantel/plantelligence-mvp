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
import {
  fillHelpCardTokens,
  getHelpCardContent,
} from "@/lib/help-card-defaults";
import {
  HELP_CARD_ROW_1_SIZE,
  helpCardPrimaryId,
  helpCardSide,
  isHelpCardEnabled,
  moveHelpCard,
  normalizeHelpCardLayout,
  setHelpCardEnabled,
  setHelpCardPrimary,
  setHelpCardSide,
} from "@/lib/help-card-layout";
import type { HelpCardLayoutEntry } from "@/types/benefit";
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

/** 1-based row for a visual index: 0–2 → row 1, 3–6 → row 2, then every 4. */
function visualRow(index: number): number {
  if (index < HELP_CARD_ROW_1_SIZE) return 1;
  return Math.floor((index - HELP_CARD_ROW_1_SIZE) / 4) + 2;
}

function SortableHelpCardRow({
  entry,
  index,
  isPrimary,
  category,
  enabled,
  onMakePrimary,
  onToggleEnabled,
}: {
  entry: HelpCardLayoutEntry;
  index: number;
  isPrimary: boolean;
  category?: string;
  /** Whether the card renders on the hub (see `setHelpCardEnabled`). */
  enabled: boolean;
  onMakePrimary: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
}) {
  const content = getHelpCardContent(entry.id);
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
          Row {visualRow(index)} · {isPrimary ? "2/4 wide · Primary" : "1/4"}
          {enabled ? "" : " · Hidden"}
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
 *  - exactly one primary card, pinned to the LEFT or RIGHT edge of row 1, spanning
 *    2 of the grid's 4 columns. Dragging the primary is disabled — pick another
 *    card with "Make primary", and flip its edge with the Left/Right control.
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
  const layout = useMemo(() => normalizeHelpCardLayout(value), [value]);
  const primaryId = helpCardPrimaryId(layout);
  const side = helpCardSide(layout);
  // The slot mirror shows what the hub will actually render, so a hidden card
  // leaves the mirror (and its columns) behind.
  const visibleLayout = layout.filter(isHelpCardEnabled);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange(moveHelpCard(layout, String(active.id), String(over.id)));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label className="text-xs font-bold text-foreground">Card Layout</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Drag to reorder. One card is the Primary: it spans 2 of the 4
            columns, at the left or right edge of row 1. Dropping a card on the
            Primary slot makes that card the Primary. Untick a card to hide it
            from the portal — it keeps its place here. Copy is fixed per card.
          </p>
        </div>
        {/* Where the primary sits in row 1. */}
        <div className="inline-flex overflow-hidden rounded-md border border-muted text-[11px] font-semibold">
          {(["left", "right"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={side === option}
              onClick={() => onChange(setHelpCardSide(layout, option))}
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
          visibleLayout.map((entry) => {
            const content = getHelpCardContent(entry.id);
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
                  entry.primary
                    ? "col-span-2 bg-blue-600 text-white"
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
                enabled={isHelpCardEnabled(entry)}
                onMakePrimary={(id) =>
                  onChange(setHelpCardPrimary(layout, id))
                }
                onToggleEnabled={(id, nextEnabled) =>
                  onChange(setHelpCardEnabled(layout, id, nextEnabled))
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
