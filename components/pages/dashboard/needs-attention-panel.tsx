"use client";

import Link from "next/link";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Headshot } from "@/components/ui/headshot";
import type {
  PlanAttentionIssue,
  PlanAttentionIssueKind,
} from "@/lib/plan-needs-attention";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

const SWR_OPTS = {
  revalidateOnFocus: false,
  dedupingInterval: 60_000,
} as const;

interface FlaggedPlan {
  id: string;
  companyName: string;
  companyLogo: string | null;
  issues: PlanAttentionIssue[];
}

interface NeedsAttentionResponse {
  success: boolean;
  data: {
    total: number;
    plans: FlaggedPlan[];
  };
}

interface IssueAction {
  label: string;
  href: string;
}

/**
 * Where each issue sends the advisor. These are the app's supported deep links:
 *
 * - Create Benefits reads `?planId` and, optionally, `?category` (see
 *   `app/(dashboard)/benefits/page.tsx`), which opens that benefit ready to fix.
 * - The Documents page reads `?planId` to preselect the plan.
 * - The plan editor reads `?tab` to open a specific tab.
 *
 * Grouped by issue kind so a row shows one button per destination rather than one per
 * issue, which would repeat identical labels when several benefits are incomplete.
 */
function actionsForIssues(planId: string, issues: PlanAttentionIssue[]): IssueAction[] {
  const byKind = new Map<PlanAttentionIssueKind, PlanAttentionIssue[]>();
  for (const issue of issues) {
    byKind.set(issue.kind, [...(byKind.get(issue.kind) ?? []), issue]);
  }

  const actions: IssueAction[] = [];
  const id = encodeURIComponent(planId);

  const benefits = byKind.get("incomplete-benefit");
  if (benefits?.length) {
    const categories = benefits
      .map((issue) => issue.category)
      .filter((category): category is string => Boolean(category));

    // A single category links straight into it. With several, the plan-only link is used
    // instead: picking one category's link would silently hide the other broken ones.
    actions.push(
      categories.length === 1
        ? {
            label: "View Benefit",
            href: `/benefits?planId=${id}&category=${encodeURIComponent(categories[0])}`,
          }
        : { label: "View Benefits", href: `/benefits?planId=${id}` },
    );
  }

  if (byKind.has("uncategorized-documents")) {
    actions.push({ label: "Categorize Documents", href: `/documents?planId=${id}` });
  }

  if (byKind.has("missing-disclaimers")) {
    actions.push({
      label: "Add Disclaimers",
      href: `/edit-client/${id}?tab=disclaimers`,
    });
  }

  // Never leave a row without a way in, even for a kind this panel does not recognise.
  if (actions.length === 0) {
    actions.push({ label: "View/Edit", href: `/edit-client/${id}` });
  }

  return actions;
}

/**
 * Detail panel for the "Needs Attention" tile: active plans with incomplete benefit
 * content, uncategorized documents or no disclaimer content. Each issue is labelled and
 * routed to the surface that resolves it. Fetches lazily — it only mounts once the tile
 * is selected.
 */
export function NeedsAttentionPanel() {
  const { data, isLoading, error } = useSWR<NeedsAttentionResponse>(
    "/api/dashboard/needs-attention",
    jsonFetcher,
    SWR_OPTS,
  );

  if (isLoading) {
    return (
      <ul className="space-y-2.5">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index} className="flex items-center gap-3">
            <div className="size-9 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-4 w-40 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn’t load the plans needing attention. Try again in a moment.
      </p>
    );
  }

  const plans = data?.data?.plans ?? [];

  if (plans.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing needs your attention — every active plan looks complete.
      </p>
    );
  }

  return (
    <ul>
      {plans.map((plan) => (
        <li
          key={plan.id}
          className="border-b border-[#efefef] py-3 transition-colors hover:bg-muted/50 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="size-9 shrink-0 overflow-hidden rounded-full border border-[#efefef] bg-muted dark:border-gray-600">
              <Headshot
                src={plan.companyLogo || undefined}
                alt={plan.companyName}
                objectFit="contain"
                monogramName={plan.companyName}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium dark:text-gray-100">
                {plan.companyName}
              </p>
              {plan.issues.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {plan.issues.map((issue) => (
                    <li
                      key={`${issue.kind}-${issue.label}`}
                      className="rounded-full bg-[#FF6900]/10 px-2 py-0.5 text-[0.7em] font-medium text-[#FF6900]"
                    >
                      {issue.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Actions sit on their own line so a plan with several issues can show one
              button per destination without squeezing the plan name. */}
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {actionsForIssues(plan.id, plan.issues).map((action) => (
              <Button
                key={action.href}
                asChild
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                <Link
                  href={action.href}
                  aria-label={`${action.label} for ${plan.companyName}`}
                >
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
