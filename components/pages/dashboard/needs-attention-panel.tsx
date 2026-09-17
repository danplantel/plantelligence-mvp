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

/** Amber chip naming the problem, e.g. "Incomplete benefit: Retirement". */
const ALERT_CHIP =
  "rounded-full bg-[#FF6900]/10 px-2 py-0.5 text-[0.7em] font-medium text-[#FF6900]";

/** Muted chip naming a specific missing field, e.g. "Description missing". */
const DETAIL_CHIP =
  "rounded-full bg-muted px-2 py-0.5 text-[0.7em] text-muted-foreground";

/**
 * Cap on detail chips per issue. `getBenefitCompleteness` can report six missing fields
 * for a single category, and several categories can be broken at once, so an uncapped
 * list would make the row taller than the panel. The remainder is summarised.
 */
const MAX_DETAIL_CHIPS = 4;

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

interface IssueChip {
  key: string;
  text: string;
  tone: "alert" | "detail";
}

/**
 * Flattens issues into chips: the headline for each issue followed by the fields that
 * still need completing.
 */
function chipsForIssues(issues: PlanAttentionIssue[]): IssueChip[] {
  const chips: IssueChip[] = [];

  for (const issue of issues) {
    chips.push({ key: `alert-${issue.label}`, text: issue.label, tone: "alert" });

    const missing = issue.missing ?? [];
    for (const field of missing.slice(0, MAX_DETAIL_CHIPS)) {
      chips.push({
        key: `detail-${issue.label}-${field}`,
        text: field,
        tone: "detail",
      });
    }
    if (missing.length > MAX_DETAIL_CHIPS) {
      chips.push({
        key: `detail-${issue.label}-more`,
        text: `+${missing.length - MAX_DETAIL_CHIPS} more`,
        tone: "detail",
      });
    }
  }

  return chips;
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
 * content, uncategorized documents or no disclaimer content. Each plan shows why it was
 * flagged — including the specific fields still to complete — and the action that fixes
 * it. Fetches lazily — it only mounts once the tile is selected.
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
          {/* One row: logo, plan name + issue chips, and the actions on the right. The
              row is allowed to wrap, so on narrow widths the actions drop below rather
              than squeezing the plan name down to nothing. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="size-9 shrink-0 overflow-hidden rounded-full border border-[#efefef] bg-muted dark:border-gray-600">
              <Headshot
                src={plan.companyLogo || undefined}
                alt={plan.companyName}
                objectFit="contain"
                monogramName={plan.companyName}
              />
            </div>

            <div className="min-w-[14rem] flex-1">
              <p className="truncate text-sm font-medium dark:text-gray-100">
                {plan.companyName}
              </p>
              {plan.issues.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {chipsForIssues(plan.issues).map((chip) => (
                    <li
                      key={chip.key}
                      className={chip.tone === "alert" ? ALERT_CHIP : DETAIL_CHIP}
                    >
                      {chip.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
          </div>
        </li>
      ))}
    </ul>
  );
}
