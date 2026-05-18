"use client";

import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import { PRIMARY_SERVICE_CATEGORY_OPTIONS } from "@/lib/service-categories";

interface PrimaryServiceCategoriesSelectProps {
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Max categories (default 4). Add Category disabled once reached. */
  maxSelections?: number;
  /** Optional label above the dropdown */
  label?: React.ReactNode;
  /** Optional helper text below */
  helperText?: string;
}

/**
 * Shared primary service categories selector.
 * Same options and UI in Step 2 (onboarding) and Settings.
 */
export function PrimaryServiceCategoriesSelect({
  selectedValues,
  onSelectionChange,
  placeholder = "Select service categories...",
  className,
  disabled = false,
  maxSelections = 4,
  label,
  helperText,
}: PrimaryServiceCategoriesSelectProps) {
  const options = [...PRIMARY_SERVICE_CATEGORY_OPTIONS];

  return (
    <div className="space-y-2">
      {label != null && (
        <label className="block font-medium text-sm">{label}</label>
      )}
      <MultiSelectDropdown
        options={options}
        selectedValues={selectedValues}
        onSelectionChange={onSelectionChange}
        placeholder={placeholder}
        displayMode="chips"
        className={className}
        disabled={disabled}
        maxSelections={maxSelections}
        allowCustomInput={false}
      />
      {helperText != null && (
        <p className="mt-1 text-muted-foreground text-xs">{helperText}</p>
      )}
    </div>
  );
}
