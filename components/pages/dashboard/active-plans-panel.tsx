"use client";

import Link from "next/link";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Headshot } from "@/components/ui/headshot";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

const SWR_OPTS = {
  revalidateOnFocus: false,
  dedupingInterval: 60_000,
} as const;

interface ActivePlanSummary {
  id: string;
  companyName: string;
  companyLogo: string | null;
}

interface ActivePlansResponse {
  success: boolean;
  data: ActivePlanSummary[];
}

/**
 * Detail panel for the Active Plans tile: a minified list of the user's active plans
 * showing logo and name, each with a View/Edit action into the client editor.
 * Fetches lazily — it only mounts once the tile is selected.
 */
export function ActivePlansPanel() {
  const { data, isLoading, error } = useSWR<ActivePlansResponse>(
    "/api/dashboard/active-plans",
    jsonFetcher,
    SWR_OPTS,
  );

  if (isLoading) {
    return (
      <ul className="space-y-2.5">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index} className="flex items-center gap-3">
            <div className="size-9 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-40 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </li>
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn’t load your active plans. Try again in a moment.
      </p>
    );
  }

  const plans = data?.data ?? [];

  if (plans.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active plans yet. Plans appear here once a Benefits Hub leaves draft.
      </p>
    );
  }

  return (
    <ul>
      {plans.map((plan) => (
        <li
          key={plan.id}
          className="flex items-center gap-3 border-b border-[#efefef] py-3 transition-colors hover:bg-muted/50 dark:border-gray-700"
        >
          {/* Headshot handles R2 keys, plain URLs and base64 alike, and falls back to a
              monogram of the company name when there is no usable logo. */}
          <div className="size-9 shrink-0 overflow-hidden rounded-full border border-[#efefef] bg-muted dark:border-gray-600">
            <Headshot
              src={plan.companyLogo || undefined}
              alt={plan.companyName}
              objectFit="contain"
              monogramName={plan.companyName}
            />
          </div>

          <span className="min-w-0 flex-1 truncate text-sm font-medium dark:text-gray-100">
            {plan.companyName}
          </span>

          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link
              href={`/edit-client/${plan.id}`}
              aria-label={`View or edit ${plan.companyName}`}
            >
              View/Edit
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
