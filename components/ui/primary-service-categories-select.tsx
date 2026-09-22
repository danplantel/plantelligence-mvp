"use client";

import { useCallback } from "react";
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
}: PrimaryServiceCategoriesSelectProps) {
  const options = [...PRIMARY_SERVICE_CATEGORY_OPTIONS];

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
