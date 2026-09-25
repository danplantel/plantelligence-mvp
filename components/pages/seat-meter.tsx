"use client";

import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

/**
 * Spec T3 Part A item 3: "X of Y seats used, with pending invites shown
 * separately. Visible in Settings → Team and on the dashboard."
 *
 * `seatsUsed` already includes pending invites (they reserve a seat), so the
 * pending count is shown alongside rather than added — otherwise the meter would
 * double-count them.
 */
export interface SeatUsageSummary {
  seatsIncluded: number;
  seatsUsed: number;
  seatsPending: number;
  seatsActive: number;
  seatsAvailable: number;
  atLimit: boolean;
  planTier: string;
}

export function SeatMeter({
  usage,
  className,
}: {
  usage: SeatUsageSummary;
  className?: string;
}) {
  const percent =
    usage.seatsIncluded > 0
      ? Math.min(100, Math.round((usage.seatsUsed / usage.seatsIncluded) * 100))
      : 0;

  const plural = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? "" : "s"}`;

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            {usage.seatsUsed} of {usage.seatsIncluded} seats used
          </p>
          {usage.seatsPending > 0 ? (
            <p className="text-xs text-muted-foreground">
              {plural(usage.seatsPending, "pending invite")}
            </p>
          ) : null}
        </div>

        <Progress value={percent} className="mt-3" />

        <p className="mt-2 text-xs text-muted-foreground">
          {plural(usage.seatsActive, "active Team Member")} ·{" "}
          {plural(usage.seatsAvailable, "seat")} available
          {usage.atLimit ? " · at limit — adding one asks for an upgrade" : ""}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Fetch the seat meter. Returns `null` while loading and on a 403, so a teammate
 * or Viewer simply doesn't render the meter instead of seeing an error.
 */
export function useSeatUsage(): SeatUsageSummary | null {
  const [usage, setUsage] = useState<SeatUsageSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/teammates/seats", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as { seats?: SeatUsageSummary };
        return body.seats ?? null;
      })
      .then((seats) => {
        if (!cancelled) setUsage(seats);
      })
      .catch(() => {
        /* the meter is informational — never surface a failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return usage;
}
