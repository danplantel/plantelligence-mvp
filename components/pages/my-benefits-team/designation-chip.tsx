"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  designationAcronym,
  designationTitle,
} from "@/config/onboarding/designations";

/**
 * A designation pill on a contact card.
 *
 * The chip shows the ACRONYM ("CFP®") because a card has room for one short word; the
 * full credential only fits behind a hover, so hovering (or focusing, for keyboard and
 * screen-reader users) expands it — "CFP® — Certified Financial Planner", acronym
 * first. The same tooltip the benefit-category pills use, so the two kinds of pill on
 * a card behave alike.
 *
 * A free-text designation the dictionary does not know is shown as typed, and its
 * tooltip repeats it rather than inventing an expansion.
 */
export interface DesignationChipProps {
  /** The stored designation: an id, a legacy label, or free text. */
  value: string;
  /** The card's chip styling — padding, text size, colour and background. */
  className?: string;
  style?: React.CSSProperties;
}

export function DesignationChip({
  value,
  className,
  style,
}: DesignationChipProps) {
  const acronym = designationAcronym(value);
  const tooltip = designationTitle(value);

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Focusable so the full name is reachable without a pointer. */}
          <span className={className} style={style} tabIndex={0}>
            {acronym}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          // Neutral ink rather than the shared tooltip's `bg-primary` (the accent
          // blue): this chip sits on a coloured card, and a brand-blue tooltip read as
          // part of the card's palette instead of as a hint.
          //
          // `whitespace-nowrap`: "CFP® — Certified Financial Planner" is one fact, and
          // a wrapped hint read as two lines of unrelated text.
          className="whitespace-nowrap bg-gray-900 px-2 py-1 text-[11px] leading-snug text-white shadow-md dark:bg-gray-100 dark:text-gray-900"
        >
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
