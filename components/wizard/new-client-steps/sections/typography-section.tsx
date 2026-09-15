"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Type as TypeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TYPOGRAPHY_THEME_LIST,
  getTypographyCssVars,
  resolveTypographyTheme,
  type TypographyThemeId,
} from "@/lib/typography-themes";

interface TypographySectionProps {
  /** Currently selected theme id (falls back to the Classic default when empty). */
  value?: string | null;
  onChange: (id: TypographyThemeId) => void;
  /** Optional heading override. */
  title?: string;
  /** Optional supporting copy override. */
  description?: string;
  className?: string;
  /** Renders the cards in a single column (useful inside narrow editor panels). */
  compact?: boolean;
}

/**
 * Portal typography theme picker.
 *
 * Each card previews its own headline/body fonts in place (using the CSS
 * variables registered by `next/font`), so the advisor sees the real fonts
 * before applying them. Shared by the Create Plan, Edit Plan, and Create
 * Benefits flows (all placed on Step 2 next to a live portal preview).
 */
export function TypographySection({
  value,
  onChange,
  title = "Typography",
  description,
  className,
  compact = false,
}: TypographySectionProps) {
  const selectedId = resolveTypographyTheme(value).id;

  return (
    <Card className={cn("dark:bg-gray-800", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-gray-100">
          <TypeIcon className="w-5 h-5 text-accent-blue" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          {description ??
            "Choose a style for your portal. Headline and body fonts change together. This theme is applied to every page on the website."}
        </p>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "grid gap-4",
            compact
              ? "grid-cols-1"
              : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
          )}
        >
          {TYPOGRAPHY_THEME_LIST.map((theme) => {
            const isSelected = selectedId === theme.id;
            // Activate this theme's fonts for the preview subtree only.
            const previewVars = getTypographyCssVars(theme.id);

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onChange(theme.id)}
                aria-pressed={isSelected}
                aria-label={`${theme.label} typography theme`}
                className={cn(
                  "relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all",
                  isSelected
                    ? "border-accent-blue bg-accent-blue/5 shadow-sm ring-1 ring-accent-blue"
                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {theme.label}
                  </span>
                  {isSelected && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-blue text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>

                {/* Live preview — rendered in this theme's fonts. */}
                <div
                  className="rounded-lg border border-gray-100 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-900/40"
                  style={previewVars as React.CSSProperties}
                >
                  <p
                    className="text-[22px] leading-tight font-semibold text-gray-900"
                    style={{ fontFamily: theme.headline }}
                  >
                    Benefits Hub
                  </p>
                  <p
                    className="mt-2 text-[12px] leading-relaxed text-gray-600"
                    style={{ fontFamily: theme.body }}
                  >
                    Explore your benefits, find resources, and connect with your
                    team.
                  </p>
                  {/* UI sample — always Outfit via --font-ui. */}
                  <span
                    className="mt-3 inline-flex rounded-md bg-accent-blue px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
                    style={{ fontFamily: theme.ui }}
                  >
                    View Details
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Headline:
                    </span>{" "}
                    {theme.headlineName}
                  </p>
                  <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Body:
                    </span>{" "}
                    {theme.bodyName}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-muted-foreground dark:text-gray-400">
          Buttons, navigation, form labels, and other interface elements always
          use Outfit regardless of the selected theme.
        </p>
      </CardContent>
    </Card>
  );
}

export default TypographySection;
