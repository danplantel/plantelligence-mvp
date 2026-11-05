"use client";

import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import {
  KEY_CONTACT_CARD_STYLE_CHOICES,
  type KeyContactCardStyle,
} from "@/lib/key-contact-card-style";
import { cn } from "@/lib/utils";

export interface MainContactStyleSectionProps {
  /** The style currently chosen — the plan's stored value, already normalised. */
  value: KeyContactCardStyle;
  /** Called with the style the advisor picked. */
  onChange: (value: KeyContactCardStyle) => void;
  /** Section number in its host panel. Defaults to 1. */
  number?: number;
}

/**
 * "Section 1 — Main Contact Highlight Style".
 *
 * The main contact's card on My Benefits Team can be drawn two ways: the neutral
 * card every other contact gets, or filled with the plan's primary colour with
 * its contents inverted — the same treatment a benefit gives its key contact in
 * "Have Questions?" (Section 8 of the benefit editor).
 *
 * The two choices, their labels and their hints come from
 * [`KEY_CONTACT_CARD_STYLE_CHOICES`](../../lib/key-contact-card-style.ts:34), so
 * this control cannot describe the styles differently from the benefit editor or
 * the wizard's preview.
 */
export function MainContactStyleSection({
  value,
  onChange,
  number = 1,
}: MainContactStyleSectionProps) {
  return (
    <section data-section-id="main-contact-style" className="space-y-3">
      <SectionHeader number={number} title="Main Contact Highlight Style" />

      <p className="text-xs text-muted-foreground">
        How the main contact&rsquo;s card is drawn at the top of My Benefits Team.
        Every other contact keeps the neutral card.
      </p>

      <div
        role="group"
        aria-label="Main Contact Highlight Style"
        className="grid grid-cols-2 gap-2"
      >
        {KEY_CONTACT_CARD_STYLE_CHOICES.map((choice) => {
          const isSelected = value === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              aria-pressed={isSelected}
              title={choice.hint}
              onClick={() => onChange(choice.value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-all cursor-pointer",
                isSelected
                  ? "border-accent-blue bg-accent-blue/5 shadow-sm dark:bg-accent-blue/10"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
              )}
            >
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                {choice.label}
              </span>
              <span className="text-[10px] leading-snug text-gray-500 dark:text-gray-400">
                {choice.hint}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
