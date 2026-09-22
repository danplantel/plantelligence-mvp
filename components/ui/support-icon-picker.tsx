"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  SUPPORT_ICON_OPTIONS,
  normalizeSupportIconId,
  type SupportIconId,
} from "@/lib/support-icons";

export interface SupportIconPickerProps {
  /** Currently selected icon id (any stored value is tolerated). */
  value?: SupportIconId | string | null;
  /** Called with the newly selected icon id. */
  onChange: (value: SupportIconId) => void;
  /** Optional heading override. */
  label?: string;
  className?: string;
}

/**
 * Lets the advisor choose the icon shown in the circular badge on a
 * Team / Support Line contact's card (headset, multi-person profile, or phone).
 */
export function SupportIconPicker({
  value,
  onChange,
  label = "Support Icon",
  className,
}: SupportIconPickerProps) {
  const selected = normalizeSupportIconId(value);

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="dark:text-gray-300 text-xs font-medium">{label}</Label>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        Choose the icon shown on this Team / Support Line contact&rsquo;s card.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {SUPPORT_ICON_OPTIONS.map(({ id, label: optionLabel, description, Icon }) => {
          const isActive = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={isActive}
              title={description}
              className={cn(
                "flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all",
                isActive
                  ? "border-accent-blue bg-accent-blue/5 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
              )}
            >
              <span
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  isActive ? "bg-accent-blue/10" : "bg-gray-100 dark:bg-gray-700",
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isActive
                      ? "text-accent-blue"
                      : "text-gray-500 dark:text-gray-400",
                  )}
                />
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight text-center",
                  isActive ? "text-accent-blue" : "text-gray-600 dark:text-gray-300",
                )}
              >
                {optionLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
