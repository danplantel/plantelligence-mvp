"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The benefit category (or categories) a contact card speaks for.
 *
 * One contact can cover several benefits — the advisor's own row, for one, carries every
 * primary service category. Two layouts cover the two places this is used:
 *
 *  - `collapsed` (default): a single category is named, and several fold into one
 *    "Multiple Categories" pill with the list on hover (and on keyboard focus,
 *    because the trigger is focusable). This is the wizard preview's floating tag,
 *    where a row of pills would sit on top of the card's own content.
 *  - `pills`: one pill per category. The My Benefits Team cards use this, so every
 *    benefit a contact covers is readable at a glance rather than behind a hover.
 *
 * Styling matches the tag the portal cards already rendered inline, so this reads as the
 * same element rather than a new component on the card.
 */
export interface ContactCategoryBadgeProps {
  categories?: (string | null | undefined)[] | null;
  /** Wording used when more than one category applies (`collapsed` layout only). */
  multipleLabel?: string;
  /**
   * `collapsed` folds several categories into one pill; `pills` renders one pill
   * per category. Defaults to `collapsed`.
   */
  layout?: "collapsed" | "pills";
  /** Extra classes for the badge (or the pill row) — margins vary by card variant. */
  className?: string;
}

const BADGE_CLASS =
  "inline-flex max-w-full items-center truncate rounded-full border border-black/5 bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 shadow-sm dark:border-white/10 dark:bg-gray-800/90 dark:text-gray-300";

/**
 * Pill-width labels. A card pill has room for one short word, and the benefit is
 * already understood from the context it sits in, so the canonical names lose the
 * "Group" prefix: "Group Health" → "Health", "Group Life" → "Life".
 *
 * Display only — the pill keeps the full name in its `title`, and the collapsed
 * layout (and its aria-label) still reads the canonical spelling.
 */
const PILL_LABEL_OVERRIDES: Record<string, string> = {
  "Group Health": "Health",
  "Group Life": "Life",
};

export function ContactCategoryBadge({
  categories,
  multipleLabel = "Multiple Categories",
  layout = "collapsed",
  className,
}: ContactCategoryBadgeProps) {
  const list = Array.from(
    new Set(
      (categories || [])
        .map((category) => String(category || "").trim())
        .filter(Boolean),
    ),
  );

  if (list.length === 0) return null;

  // One pill per category. The row wraps rather than truncating, so a contact who
  // covers three benefits shows all three instead of hiding two behind a hover.
  if (layout === "pills") {
    return (
      <div
        className={cn(
          "flex max-w-full flex-wrap items-center gap-1",
          className,
        )}
        data-category-count={list.length}
      >
        {list.map((category) => (
          <span key={category} className={BADGE_CLASS} title={category}>
            {PILL_LABEL_OVERRIDES[category] ?? category}
          </span>
        ))}
      </div>
    );
  }

  if (list.length === 1) {
    return (
      <span className={cn(BADGE_CLASS, className)} title={list[0]}>
        {list[0]}
      </span>
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(BADGE_CLASS, "cursor-help", className)}
            // Focusable so the list is reachable without a pointer.
            tabIndex={0}
            aria-label={`${multipleLabel}: ${list.join(", ")}`}
          >
            {multipleLabel}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-[260px]">
          <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-80">
            Benefits covered
          </span>
          <ul className="mt-1 space-y-0.5">
            {list.map((category) => (
              <li key={category} className="text-xs">
                {category}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
