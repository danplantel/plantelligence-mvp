"use client";

import { Label } from "@/components/ui/label";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import { BenefitsCategory } from "@/types/new-client-wizard";

const BENEFITS_CATEGORY_OPTIONS: BenefitsCategory[] = [
  "Company / Plan Sponsor",
  "Retirement",
  "Group Health",
  "Group Life",
  "Other Benefits",
  "Recordkeeper / Vendor",
];

interface BenefitsCategorySelectorProps {
  value: BenefitsCategory[];
  onChange: (value: BenefitsCategory[]) => void;
  error?: boolean;
  disabled?: boolean;
  /** When plan has 4 categories, only allow these (cannot add 5th). Omit to allow all. */
  allowedCategories?: string[];
}

export function BenefitsCategorySelector({
  value,
  onChange,
  error = false,
  disabled = false,
  allowedCategories,
}: BenefitsCategorySelectorProps) {
  const options =
    allowedCategories && allowedCategories.length === 4
      ? BENEFITS_CATEGORY_OPTIONS.filter((c) => allowedCategories.includes(c))
      : BENEFITS_CATEGORY_OPTIONS;

  return (
    <div className="space-y-2" data-field="benefitsCategories">
      <Label>
        Benefits Categories <span className="text-red-500">*</span>
      </Label>
      <div className="space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          We recommend starting with{" "}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            Company / Plan Sponsor
          </span>
          , but you can build in a different order by selecting a different
          category. Plan must have 1–4 categories.
        </p>
        <MultiSelectDropdown
          options={options}
          selectedValues={value}
          onSelectionChange={(values) => {
            if (!disabled) {
              onChange(values as BenefitsCategory[]);
            }
          }}
          placeholder="Select benefits categories (max 4)..."
          className={error ? "border-red-500" : ""}
          disabled={disabled}
          maxSelections={4}
          allowCustomInput={false}
        />
      </div>
    </div>
  );
}
