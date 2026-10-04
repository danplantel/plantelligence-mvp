import type {
  PlanAttentionIssue,
  PlanAttentionIssueKind,
} from "@/lib/plan-needs-attention";
import { categoryToSlug } from "@/lib/benefit-category-slug";

/**
 * Where a needs-attention issue sends the advisor.
 *
 * These are the app's supported deep links:
 *  - The Create Benefit wizard reads `?planId` and, optionally, `?category`
 *    (see `app/(dashboard)/new-benefits/page.tsx`), opening that benefit ready to fix.
 *  - The Edit Benefit page is `/edit-benefit/<planId>/<category>`.
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
            href: `/edit-benefit/${id}/${categoryToSlug(issue.category)}`,
          }
        : { label: "View Benefit", href: `/benefits` };
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
export interface IssueDestinationsOptions {
  /**
   * A read-only reader (a Viewer): return only destinations that do not require edit access.
   * "View Benefit" stays; "Categorize Documents", "Add Disclaimers" and the "View/Edit"
   * fallback are withheld, because a Viewer's grid grants those functions `view` at most.
   */
  readOnly?: boolean;
}

export function issueDestinations(
  planId: string,
  issues: PlanAttentionIssue[],
  options: IssueDestinationsOptions = {},
): IssueDestination[] {
  const readOnly = options.readOnly === true;
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
            href: `/edit-benefit/${id}/${categoryToSlug(categories[0])}`,
          }
        : { label: "View Benefits", href: `/benefits` },
    );
  }

  if (!readOnly && byKind.has("uncategorized-documents")) {
    destinations.push({
      label: "Categorize Documents",
      href: `/documents?planId=${id}`,
    });
  }

  if (!readOnly && byKind.has("missing-disclaimers")) {
    destinations.push({
      label: "Add Disclaimers",
      href: `/edit-client/${id}?tab=disclaimers`,
    });
  }

  // The generic fallback edits the plan, which a read-only Viewer may not do — so it is
  // withheld for them rather than pointing at an edit the save would refuse. A row with no
  // read destination simply renders no action; the issue chips still explain the problem.
  if (destinations.length === 0 && !readOnly) {
    destinations.push({ label: "View/Edit", href: `/edit-client/${id}` });
  }

  return destinations;
}
