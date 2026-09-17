"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { cn } from "@/lib/utils";

export interface QuickInsightItem {
  id: string;
  title: string;
  /** Live metric, or a placeholder. Omitted when a metric has no value yet. */
  value?: number | string;
  hint?: string;
  icon: LucideIcon;
  /** Tailwind text-colour class applied to the icon accent. */
  color?: string;
}

interface QuickInsightsProps {
  insights: QuickInsightItem[];
  title?: string;
  isLoading?: boolean;
  /** Skeleton tiles to render while loading. Defaults to the number of insights. */
  skeletonCount?: number;
  /**
   * Detail content revealed beneath the grid when a tile is selected. Receives the
   * selected insight. Return `null`/`undefined` for metrics whose detail view is not
   * built yet — the panel then shows a neutral notice rather than an empty box.
   */
  renderDetail?: (insight: QuickInsightItem) => ReactNode;
}

/**
 * KPI grid. Renders up to four tiles per row on desktop, two on tablet, one on mobile.
 * Each tile is a toggle button; selecting one expands a detail panel beneath the grid,
 * and selecting it again (or the close button) collapses it. Both directions animate.
 * Shows placeholder tiles while `isLoading` so the grid does not collapse on first paint.
 */
export function QuickInsights({
  insights,
  title = "Quick Insights",
  isLoading = false,
  skeletonCount = insights.length || 4,
  renderDetail,
}: QuickInsightsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * Latched id of the last opened tile. `selectedId` clears the moment a tile closes,
   * but the panel still needs its content to animate that close, so the id is retained
   * until the collapse finishes.
   */
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null);
  const baseId = useId();
  const panelId = `${baseId}-panel`;

  useEffect(() => {
    if (selectedId) setLastOpenedId(selectedId);
  }, [selectedId]);

  // Falling back to `lastOpenedId` means the content is present in the same commit that
  // opens or closes the panel, so neither direction animates an empty box.
  const contentId = selectedId ?? lastOpenedId;
  const contentInsight = contentId
    ? (insights.find((insight) => insight.id === contentId) ?? null)
    : null;
  const detail = contentInsight ? renderDetail?.(contentInsight) : null;

  return (
    <section>
      <h3 className="mb-3 text-base font-semibold dark:text-gray-100">{title}</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: skeletonCount }, (_, index) => (
              <Card
                key={`quick-insight-skeleton-${index}`}
                className="dark:border-gray-700 dark:bg-gray-800"
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="size-10 shrink-0 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-6 w-10 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-24 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                </CardContent>
              </Card>
            ))
          : insights.map((insight) => {
              const isSelected = insight.id === selectedId;

              return (
                <button
                  key={insight.id}
                  type="button"
                  onClick={() => setSelectedId(isSelected ? null : insight.id)}
                  aria-expanded={isSelected}
                  aria-controls={isSelected ? panelId : undefined}
                  className="h-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  <Card
                    className={cn(
                      "h-full cursor-pointer border-[#efefef] transition-colors hover:border-accent-blue dark:border-gray-700 dark:bg-gray-800",
                      isSelected && "border-accent-blue dark:border-accent-blue",
                    )}
                  >
                    <CardContent className="flex items-center gap-4 p-5">
                      <div
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted",
                          insight.color,
                        )}
                      >
                        <insight.icon className="size-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-2xl font-semibold leading-none tabular-nums dark:text-gray-100">
                          {insight.value ?? "—"}
                        </p>
                        <p className="mt-1.5 truncate text-sm text-muted-foreground">
                          {insight.title}
                        </p>
                        {insight.hint && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                            {insight.hint}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
      </div>

      <CollapsiblePanel
        id={panelId}
        open={selectedId !== null}
        label={contentInsight ? `${contentInsight.title} details` : undefined}
      >
        {contentInsight && (
          /* Spacing lives inside the panel, not on the section, so a collapsed panel
             adds no gap between the grid and whatever follows. */
          <div className="pt-3">
            {/* Fixed height so every panel is the same size regardless of how much a
                metric returns; the body scrolls instead of the panel growing. */}
            <div className="flex h-80 flex-col rounded-xl border border-[#efefef] bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex shrink-0 items-start justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold dark:text-gray-100">
                    {contentInsight.title}
                  </h4>
                  {contentInsight.hint && (
                    <p className="text-xs text-muted-foreground">
                      {contentInsight.hint}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label={`Close ${contentInsight.title} details`}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* `min-h-0` is required for the flex child to shrink and scroll rather
                  than expand the fixed-height panel. `overscroll-contain` stops the
                  scroll from chaining to the page at either end of the list. */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                {detail ?? (
                  <p className="text-sm text-muted-foreground">
                    No detail view is available for this metric yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CollapsiblePanel>
    </section>
  );
}
