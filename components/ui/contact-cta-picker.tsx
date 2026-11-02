"use client";

import { cn } from "@/lib/utils";
import {
  CONTACT_CTA_OPTIONS,
  MAX_CTAS_PER_CONTACT,
  type ContactCtaOption,
} from "@/lib/contact-cta";

/**
 * The actions a contact's card can offer — a MULTI-select with a ceiling of two.
 *
 * Every contact editor (Create Plan's Step 1 and Step 3 forms, Edit Plan, the benefit
 * contact dialog, the Team Seat invitation) renders this same control, so the rule and
 * its wording cannot differ between entry points. The order the advisor picks them in
 * is the order the buttons appear in, and the first one is the card's primary button.
 *
 * A third action is refused rather than silently replacing one of the chosen two: the
 * card shows them side by side in a single row.
 */
export interface ContactCtaPickerProps {
  value: ContactCtaOption[];
  onChange: (next: ContactCtaOption[]) => void;
  /** Tighter type/padding, for narrow panels (the inline contact editors). */
  compact?: boolean;
  className?: string;
  /**
   * Hide the explanatory line — the callers that already describe the section in
   * their own copy (the invitation form) set this.
   */
  hideHint?: boolean;
}

export function ContactCtaPicker({
  value,
  onChange,
  compact = false,
  className,
  hideHint = false,
}: ContactCtaPickerProps) {
  const atLimit = value.length >= MAX_CTAS_PER_CONTACT;

  const toggle = (option: ContactCtaOption) => {
    if (value.includes(option)) {
      onChange(value.filter((entry) => entry !== option));
      return;
    }
    if (atLimit) return;
    onChange([...value, option].slice(0, MAX_CTAS_PER_CONTACT));
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="grid grid-cols-2 gap-1.5">
        {CONTACT_CTA_OPTIONS.map((option) => {
          const isActive = value.includes(option.value);
          const isBlocked = !isActive && atLimit;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              aria-disabled={isBlocked}
              title={
                isBlocked
                  ? `A contact can show up to ${MAX_CTAS_PER_CONTACT} actions`
                  : option.hint
              }
              onClick={() => toggle(option.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border text-left transition-all",
                compact ? "px-2 py-1" : "px-2.5 py-1.5",
                isActive
                  ? "border-[#23919C] bg-[#23919C]/5 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                isBlocked &&
                  "cursor-not-allowed opacity-50 hover:border-gray-200 dark:hover:border-gray-600",
              )}
            >
              <span
                className={cn(
                  "font-medium",
                  compact ? "text-[10px]" : "text-[11px]",
                )}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {!hideHint && (
        <p
          className={cn(
            "leading-relaxed text-gray-500 dark:text-gray-400",
            compact ? "text-[10px]" : "text-[10px]",
          )}
        >
          <span className="font-bold">Choose up to {MAX_CTAS_PER_CONTACT} actions.</span> They appear side by side as
          buttons on the contact&rsquo;s card, in the order you pick them; the first
          one is the highlighted button.
          {atLimit ? " Deselect one to swap it for another." : ""}
        </p>
      )}
    </div>
  );
}
