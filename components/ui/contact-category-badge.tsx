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
 * primary service category — and spelling them all out made the badge as wide as the card.
 * A single category is named; several collapse to "Multiple Categories", with the list on
 * hover (and on keyboard focus, because the trigger is focusable).
 *
 * Styling matches the tag the portal cards already rendered inline, so this reads as the
 * same element rather than a new component on the card.
 */
export interface ContactCategoryBadgeProps {
  categories?: (string | null | undefined)[] | null;
  /** Wording used when more than one category applies. */
  multipleLabel?: string;
  /** Extra classes for the badge itself (margins vary by card variant). */
  className?: string;
}

const BADGE_CLASS =
  "inline-flex max-w-full items-center truncate rounded-full border border-black/5 bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 shadow-sm dark:border-white/10 dark:bg-gray-800/90 dark:text-gray-300";

export function ContactCategoryBadge({
  categories,
  multipleLabel = "Multiple Categories",
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
