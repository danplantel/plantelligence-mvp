import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface QuickInsightItem {
  id: string;
  title: string;
  value: number | string;
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
}

/**
 * KPI grid. Renders up to four tiles per row on desktop, two on tablet, one on mobile.
 * Shows placeholder tiles while `isLoading` so the grid does not collapse on first paint.
 */
export function QuickInsights({
  insights,
  title = "Quick Insights",
  isLoading = false,
  skeletonCount = insights.length || 4,
}: QuickInsightsProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold dark:text-gray-100">{title}</h3>

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
          : insights.map((insight) => (
              <Card
                key={insight.id}
                className="dark:border-gray-700 dark:bg-gray-800"
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
                      {insight.value}
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
            ))}
      </div>
    </section>
  );
}
