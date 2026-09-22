"use client";

import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Pencil, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandingImage } from "@/components/ui/branding-image";
import { cn } from "@/lib/utils";

/**
 * Condition of a benefit category, derived from the Benefit table
 * (`exists`), completeness, and the row's `isEnabled` flag.
 */
export type BenefitCategoryCardState =
  | "not-created"
  | "draft"
  | "published"
  | "hidden";

export interface BenefitCategoryCardAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline";
  icon?: "create" | "edit" | "sparkles";
}

interface BenefitCategoryCardProps {
  label: string;
  icon: LucideIcon;
  state: BenefitCategoryCardState;
  isSelected: boolean;
  /** How many setup sections are still missing (draft state). */
  missingCount: number;
  /** Which setup sections are still missing (draft state). */
  missingSections: string[];
  /** Existing benefit logo; falls back to the category icon when absent. */
  logo?: string | null;
  primary: BenefitCategoryCardAction;
  secondary?: BenefitCategoryCardAction;
}

function ActionIcon({ icon }: { icon?: BenefitCategoryCardAction["icon"] }) {
  if (icon === "edit") return <Pencil className="h-3.5 w-3.5" />;
  if (icon === "sparkles") return <Sparkles className="h-3.5 w-3.5" />;
  if (icon === "create") return <Plus className="h-3.5 w-3.5" />;
  return null;
}

function StateBadge({
  state,
  missingCount,
}: {
  state: BenefitCategoryCardState;
  missingCount: number;
}) {
  if (state === "not-created") {
    return (
      <span className="text-[11px] text-muted-foreground">Not created</span>
    );
  }
  if (state === "draft") {
    return (
      <Badge
        variant="outline"
        className="mt-1 border-amber-200 bg-amber-50 text-[10px] font-medium text-amber-600 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      >
        Draft · {missingCount} missing
      </Badge>
    );
  }
  if (state === "published") {
    return (
      <Badge className="mt-1 border-none bg-green-100 text-[10px] font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-400">
        Published
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="mt-1 text-[10px] font-medium text-gray-500 dark:text-gray-400"
    >
      Hidden
    </Badge>
  );
}

/**
 * One of the four benefit-category tiles on Create Benefit Step 1. Renders the
 * category's real state (Not created / Draft / Published / Hidden) and the
 * actions that match it, so an existing benefit is edited rather than silently
 * recreated.
 */
export function BenefitCategoryCard({
  label,
  icon: Icon,
  state,
  isSelected,
  missingCount,
  missingSections,
  logo,
  primary,
  secondary,
}: BenefitCategoryCardProps) {
  const exists = state !== "not-created";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={primary.onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          primary.onClick();
        }
      }}
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200",
        isSelected
          ? "border-[#23919C] bg-[#23919C]/5 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
      )}
    >
      {isSelected && (
        <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-[#23919C]">
          <CheckCircle2 className="size-3.5 text-white" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full transition-colors",
            isSelected
              ? "bg-[#23919C]/10 text-[#23919C]"
              : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
          )}
        >
          {exists && logo ? (
            <BrandingImage
              src={logo}
              alt={label}
              className="size-full object-contain"
            />
          ) : (
            <Icon className="size-6" />
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {label}
          </p>
          <StateBadge state={state} missingCount={missingCount} />
        </div>
      </div>

      {state === "draft" && missingSections.length > 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Missing: {missingSections.join(", ")}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={primary.variant ?? (exists ? "outline" : "default")}
          className="gap-1.5"
          onClick={(event) => {
            event.stopPropagation();
            primary.onClick();
          }}
        >
          <ActionIcon icon={primary.icon} />
          {primary.label}
        </Button>
        {secondary && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={(event) => {
              event.stopPropagation();
              secondary.onClick();
            }}
          >
            <ActionIcon icon={secondary.icon} />
            {secondary.label}
          </Button>
        )}
      </div>
    </div>
  );
}
