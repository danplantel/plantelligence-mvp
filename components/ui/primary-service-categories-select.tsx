"use client";

import { useCallback, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
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
  helperText?: React.ReactNode;
  /** Optional `data-field` attribute for wizard scroll-to-error targeting. */
  dataField?: string;
  /** Paint a red validation outline around the group. */
  destructive?: boolean;
  /**
   * An extra control that selects or clears several options at once, rendered FIRST — above the
   * option list — so it reads as one answer to "which categories do you offer" rather than a
   * footnote under the list.
   *
   * It is deliberately NOT a category: it stores nothing of its own, and its own tick is derived
   * from the values it covers. Two reasons that matters:
   *
   *  - the selections it belongs to are persisted and validated as a fixed vocabulary, so inventing
   *    a member for a convenience control would put a value in the data that no category means;
   *  - it is a shortcut for one particular customer, not a fifth answer to "which categories do you
   *    offer", so surfaces that read those answers (the portal's category keys, the contact seeder)
   *    must never see it.
   *
   * Callers name the values, so the control cannot claim to cover something it does not — and
   * `values` is expected to exclude anything the caller wants left alone (typically "Other",
   * whose text field must not be silently required by a blanket selection).
   */
  selectAll?: {
    label: string;
    /** The option values it sets and clears. */
    values: string[];
  };
}

/**
 * Shared primary service categories selector.
 * Same options and UI in Step 2 (onboarding) and Settings.
 * Now uses checkbox UI instead of dropdown.
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
  dataField,
  destructive = false,
  selectAll,
}: PrimaryServiceCategoriesSelectProps) {
  const options = [...PRIMARY_SERVICE_CATEGORY_OPTIONS];

  const selectAllValues = selectAll?.values ?? [];

  /**
   * The master control's own tick, and it moves ONLY when the user clicks the control itself.
   *
   * Deliberately not derived from the values it covers. A derived tick made it a mirror of the
   * three categories — on once all three were on, dashed once some were — which meant the box
   * changed state while the user was working somewhere else entirely, and left them unable to tell
   * whether they had switched it on. It is a one-shot convenience, so it behaves like one: tick
   * "Retirement" by hand and this box is exactly as you left it.
   *
   * A consequence worth knowing, because it is the point rather than a bug: it can read as on while
   * nothing it covers is selected, if the categories are then cleared individually. Clearing them
   * is the user's edit; the box reflects the user's last click on it.
   */
  const [selectAllChecked, setSelectAllChecked] = useState(false);

  /**
   * Set or clear everything the master covers, and nothing else.
   *
   * `maxSelections` is deliberately not applied here. The cap stops a person adding more categories
   * than the vocabulary supports; this control is the declared union of what the list offers, so
   * silently stopping short would make its own label a lie. It also cannot breach the cap with this
   * list: it covers the three benefit categories, and the largest selection it can produce is those
   * three plus "Other" — the cap of four, exactly.
   */
  const handleSelectAllChange = (checked: boolean | "indeterminate") => {
    const next = new Set(selectedValues);
    if (checked === true) {
      for (const value of selectAllValues) next.add(value);
    } else {
      for (const value of selectAllValues) next.delete(value);
    }
    setSelectAllChecked(checked === true);
    onSelectionChange([...next]);
  };

  const handleCheckboxChange = useCallback((option: string, checked: boolean | "indeterminate") => {
    // Handle indeterminate state as unchecked
    const isChecked = checked === true;
    
    if (isChecked) {
      // Add if not at max selections
      if (selectedValues.length < maxSelections) {
        const newValues = [...selectedValues, option];
        onSelectionChange(newValues);
      }
    } else {
      // Remove
      const newValues = selectedValues.filter((v) => v !== option);
      onSelectionChange(newValues);
    }
  }, [selectedValues, maxSelections, onSelectionChange]);

  return (
    <div
      data-field={dataField}
      className={`space-y-3 ${
        destructive ? "rounded-lg border border-red-500 p-3" : ""
      } ${className || ""}`}
    >
      {label != null && (
        <label className="block font-medium text-sm">{label}</label>
      )}
      <div className="space-y-2">
        {/* First, so the convenience answer reads before the categories it covers. It sets and
            clears only the values the caller named, which is how "Other" stays out of a blanket
            selection without anyone having to remember to exclude it. */}
        {selectAll != null ? (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="category-select-all"
              checked={selectAllChecked}
              onCheckedChange={handleSelectAllChange}
              disabled={disabled}
            />
            <label
              htmlFor="category-select-all"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {selectAll.label}{" "}
              <span className="font-normal text-muted-foreground">
                {'(Manages all benefits)'}
              </span>
            </label>
          </div>
        ) : null}
        {options.map((option) => {
          const isSelected = selectedValues.includes(option);
          const isAtMaxAndNotSelected =
            selectedValues.length >= maxSelections && !isSelected;

          return (
            <div key={option} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${option}`}
                checked={isSelected}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(option, checked)
                }
                disabled={disabled || isAtMaxAndNotSelected}
              />
              <label
                htmlFor={`category-${option}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {option}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
