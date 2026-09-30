"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * "Your organization offers" — the permanent strip at the top of Browse Benefits
 * naming the benefits the advisor's organization sells
 * (`User.primaryServiceCategories`).
 *
 * Deliberately plan-independent: everything below it is scoped to the selected
 * plan, whereas these categories describe the ORGANIZATION. They are also the
 * same categories that seed a new plan's benefit visibility (Create Benefit
 * Step 1) and that decide which benefits an advisor is expected to publish, so
 * this page is the natural place to state them.
 *
 * Shown even when nothing is selected — a permanent element that disappears when
 * empty would read as a bug, and "which benefits do we offer?" is precisely the
 * thing the page is otherwise silent about.
 *
 * Fully presentational, and fed from the SERVER: the page resolves the labels and passes
 * them in, so the chips are part of the first paint. When this component fetched for
 * itself, its read raced the plan card's and could land after the plan's benefit rows —
 * a strip that arrives last looks like a late widget, not like a header.
 *
 * An empty array is a real answer ("this account has selected none"), not a loading state;
 * there is deliberately no skeleton here, because there is now nothing to wait for. The
 * read is normalized by `normalizePrimaryServiceCategories` in lib/service-categories.ts.
 */
export function OrgServiceCategories({
  categories,
}: {
  categories: string[];
}) {
  const router = useRouter();
  const hasCategories = categories.length > 0;

  return (
    <Card className="mb-6 shadow-sm dark:bg-gray-800">
      <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Your organization offers
        </span>

        {hasCategories ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((category) => (
              <Badge
                key={category}
                variant="secondary"
                // `accent-blue-light` is a mode-aware token — pale teal (#d4eef0) in
                // light mode, deep teal (#1a3f43) in dark — so one class covers both.
                // The hover tint is pinned to the same colour: the `secondary`
                // variant's `hover:bg-secondary/80` would otherwise snap the chip back
                // to grey on hover, and `/80` can't be applied to a raw `var()` hex.
                className="bg-accent-blue-light hover:bg-accent-blue-light"
              >
                {category}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            No service categories selected yet.
          </span>
        )}

        {/* These categories live in Settings → Profile (User Setup), which is also
            where Create Benefit reads them from — so the edit affordance belongs
            next to them rather than buried in the plan row below. */}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-1.5 text-muted-foreground"
          onClick={() => router.push("/settings")}
        >
          <Pencil className="h-3.5 w-3.5" />
          {hasCategories ? "Edit in Settings" : "Add in Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
