import type {
  PlanAttentionIssue,
  PlanAttentionIssueKind,
} from "@/lib/plan-needs-attention";

/**
 * Where a needs-attention issue sends the advisor.
 *
 * These are the app's supported deep links:
 *  - Create Benefits reads `?planId` and, optionally, `?category`
 *    (see `app/(dashboard)/benefits/page.tsx`), opening that benefit ready to fix.
 *  - The Documents page reads `?planId` to preselect the plan.
 *  - The plan editor reads `?tab` to open a specific tab.
 *
 * Shared by the Needs Attention panel and the dashboard task list so a routing change is made
 * once rather than in every surface that reports these issues.
 */

export interface IssueDestination {
  label: string;
  href: string;
}

/**
 * Destination for a single issue — used where one row maps to one issue, so nothing has to be
 * grouped and each benefit gets its own link.
 */
export function issueDestination(
  planId: string,
  issue: PlanAttentionIssue,
): IssueDestination {
  const id = encodeURIComponent(planId);

  switch (issue.kind) {
    case "incomplete-benefit":
      return issue.category
        ? {
            label: "View Benefit",
            href: `/benefits?planId=${id}&category=${encodeURIComponent(issue.category)}`,
          }
        : { label: "View Benefit", href: `/benefits?planId=${id}` };
    case "uncategorized-documents":
      return { label: "Categorize Documents", href: `/documents?planId=${id}` };
    case "missing-disclaimers":
      return {
        label: "Add Disclaimers",
        href: `/edit-client/${id}?tab=disclaimers`,
      };
  }
}

/**
 * One destination per issue kind, for UIs that show a single button per destination rather
 * than one per issue — otherwise several incomplete benefits would repeat the same label.
 *
 * Falls back to the plan editor, so a row is never left without a way in, including when the
 * issues present are of a kind this build does not route.
 */
export function issueDestinations(
  planId: string,
  issues: PlanAttentionIssue[],
): IssueDestination[] {
  const byKind = new Map<PlanAttentionIssueKind, PlanAttentionIssue[]>();
  for (const issue of issues) {
    byKind.set(issue.kind, [...(byKind.get(issue.kind) ?? []), issue]);
  }

  const destinations: IssueDestination[] = [];
  const id = encodeURIComponent(planId);

  const benefits = byKind.get("incomplete-benefit");
  if (benefits?.length) {
    const categories = benefits
      .map((issue) => issue.category)
      .filter((category): category is string => Boolean(category));

    // A single category links straight into it. With several, the plan-only link is used
    // instead: picking one category's link would silently hide the other broken ones.
    destinations.push(
      categories.length === 1
        ? {
            label: "View Benefit",
            href: `/benefits?planId=${id}&category=${encodeURIComponent(categories[0])}`,
          }
        : { label: "View Benefits", href: `/benefits?planId=${id}` },
    );
  }

  if (byKind.has("uncategorized-documents")) {
    destinations.push({
      label: "Categorize Documents",
      href: `/documents?planId=${id}`,
    });
  }

  if (byKind.has("missing-disclaimers")) {
    destinations.push({
      label: "Add Disclaimers",
      href: `/edit-client/${id}?tab=disclaimers`,
    });
  }

  if (destinations.length === 0) {
    destinations.push({ label: "View/Edit", href: `/edit-client/${id}` });
  }

  return destinations;
}
