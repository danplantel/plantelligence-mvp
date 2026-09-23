"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProfileOnce } from "@/lib/fetch-profile";
import { PRIMARY_SERVICE_CATEGORY_OPTIONS } from "@/lib/service-categories";

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
 */
export function OrgServiceCategories() {
  const router = useRouter();
  // `null` while loading, so the strip keeps its shape instead of collapsing and
  // pushing the plan picker up for a frame.
  const [categories, setCategories] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Shares the single-flight / short-TTL profile cache with the rest of the
      // benefits surfaces, so this costs no extra request on a typical visit.
      const profile = await fetchProfileOnce().catch(() => null);
      if (cancelled) return;

      const raw: unknown = profile?.primaryServiceCategories;
      const labels = (Array.isArray(raw) ? raw : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);

      // De-dupe, then present in the canonical order the Settings selector uses
      // so the chip order can't drift with whatever order the record holds.
      // Unknown-but-stored labels are kept, not dropped: the raw value is what the
      // organization actually offers, so hiding it would understate the list.
      const canonical = PRIMARY_SERVICE_CATEGORY_OPTIONS as readonly string[];
      const ordered = Array.from(new Set(labels)).sort((a, b) => {
        const ai = canonical.indexOf(a);
        const bi = canonical.indexOf(b);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

      setCategories(ordered);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasCategories = categories !== null && categories.length > 0;

  return (
    <Card className="mb-6 shadow-sm dark:bg-gray-800">
      <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Your organization offers
        </span>

        {categories === null ? (
          <Skeleton className="h-6 w-48" />
        ) : hasCategories ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((category) => (
              <Badge key={category} variant="secondary">
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
