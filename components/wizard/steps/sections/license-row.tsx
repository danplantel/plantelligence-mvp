"use client";

import { License, LicenseType } from "@/types/wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { FormError } from "@/components/ui/form-error";

const licenseTypes = [
  { value: LicenseType.LIFE, label: "Life" },
  { value: LicenseType.HEALTH_ACCIDENT, label: "Health/Accident" },
  { value: LicenseType.VARIABLE_LIFE_ANNUITY, label: "Variable Life/Annuity" },
  { value: LicenseType.PROPERTY_CASUALTY, label: "Property & Casualty" },
  { value: LicenseType.SURPLUS_LINES, label: "Surplus Lines" },
  { value: LicenseType.ADJUSTER, label: "Adjuster" },
  { value: LicenseType.OTHER, label: "Other" },
];

interface LicenseRowProps {
  license: License;
  onUpdate: (id: string, updates: Partial<License>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  errors?: {
    type?: string;
    customType?: string;
    number?: string;
  };
}

export function LicenseRow({
  license,
  onUpdate,
  onDuplicate,
  onDelete,
  errors,
}: LicenseRowProps) {
  const isOtherSelected = license.type === LicenseType.OTHER;

  return (
    <div className="flex items-start gap-4">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            License Type <span className="text-red-500">*</span>
          </label>
          <Select
            value={license.type || undefined}
            onValueChange={(value) =>
              onUpdate(license.id, {
                type: value as LicenseType,
                customType:
                  value === LicenseType.OTHER ? license.customType : undefined,
              })
            }
            onOpenChange={(open) => {
              if (open) {
                // Add focus when dropdown opens
                setTimeout(() => {
                  const selectTrigger = document.querySelector(
                    `[data-state="open"] button`,
                  ) as HTMLElement;
                  if (selectTrigger) {
                    selectTrigger.focus();
                  }
                }, 0);
              } else {
                // Remove focus when dropdown closes
                setTimeout(() => {
                  const activeElement = document.activeElement as HTMLElement;
                  if (activeElement) {
                    activeElement.blur();
                  }
                }, 0);
              }
            }}
          >
            <SelectTrigger className="h-12">
              {license.type ? (
                <SelectValue />
              ) : (
                <span className="text-muted-foreground">
                  Select license type
                </span>
              )}
            </SelectTrigger>
            <SelectContent>
              {licenseTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Choose the license type as shown on your state record.
          </p>
          {errors?.type && <FormError message={errors.type} />}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            License Number <span className="text-red-500">*</span>
          </label>
          <Input
            value={license.number}
            onChange={(e) =>
              onUpdate(license.id, {
                number: e.target.value,
              })
            }
            placeholder="Enter license number"
            className="h-12"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter the exact license number from the state.
          </p>
          {errors?.number && <FormError message={errors.number} />}
        </div>

        <div className="flex h-12">
          {/* Empty div to maintain grid layout */}
        </div>

        {/* Custom Type Input - appears below when "Other" is selected */}
        {isOtherSelected && (
          <div className="col-span-full mt-2">
            <label className="block text-sm font-medium mb-1">
              Specify License Type <span className="text-red-500">*</span>
            </label>
            <Input
              value={license.customType || ""}
              onChange={(e) =>
                onUpdate(license.id, {
                  customType: e.target.value,
                })
              }
              placeholder="Enter custom license type"
              maxLength={50}
              className="h-12"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum 50 characters
            </p>
            {errors?.customType && <FormError message={errors.customType} />}
          </div>
        )}
      </div>

      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            // Add focus when dropdown opens
            setTimeout(() => {
              const dropdownTrigger = document.querySelector(
                `[data-state="open"] button`,
              ) as HTMLElement;
              if (dropdownTrigger) {
                dropdownTrigger.focus();
              }
            }, 0);
          } else {
            // Remove focus when dropdown closes
            setTimeout(() => {
              const activeElement = document.activeElement as HTMLElement;
              if (activeElement) {
                activeElement.blur();
              }
            }, 0);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(license.id);
            }}
          >
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDelete(license.id);
            }}
            className="text-destructive focus:text-destructive"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
