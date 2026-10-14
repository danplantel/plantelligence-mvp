import prisma from "@/lib/prisma";
import { ACTIVE_CLIENT_STATUSES } from "@/lib/active-client-status";
import {
  derivedTaskKey,
  type ManualTask,
  type SystemTask,
} from "@/lib/dashboard-tasks";
import { issueDestination } from "@/lib/plan-attention-actions";
import type { PlanAttentionIssueKind } from "@/lib/plan-needs-attention";
import { resolveOrganizationId } from "@/lib/organization";
import { loadPersonIdentities } from "@/lib/teammates/identity.server";
import {
  evaluatePlanAttention,
  type PlanAttentionIssue,
} from "@/lib/plan-needs-attention";
import { PLAN_ATTENTION_SELECT } from "@/lib/plan-needs-attention.server";

/**
 * Prisma-backed construction of the dashboard task list.
 *
 * System tasks are *derived*, never stored: they are the same completion-state and
 * category-assignment checks the Needs Attention tile and the Benefits/Documents modules
 * already use, surfaced as actionable rows. Storing them would need a write on every plan
 * mutation and would drift from the plan it describes — deriving them means a task disappears
 * the instant the plan is fixed. Manual tasks are the only ones persisted.
 */

/** Cap on plans evaluated per request, matching the Needs Attention scan. */
const MAX_PLANS_SCANNED = 250;

/**
 * Task phrasing per issue kind. Deliberately different from the panel's chip labels: a chip
 * names the *problem* ("Incomplete benefit: Retirement"), a task names the *work*
 * ("Complete the Retirement benefit").
 *
 * The switch is exhaustive, so adding an issue kind fails the build until it is phrased.
 */
function systemTaskTitle(issue: PlanAttentionIssue): string {
  switch (issue.kind) {
    case "incomplete-benefit":
      return issue.category
        ? `Complete the ${issue.category} benefit`
        : "Complete a benefit";
    case "uncategorized-documents":
      return issue.count === 1
        ? "Categorize 1 document"
        : `Categorize ${issue.count ?? "the"} documents`;
    case "missing-disclaimers":
      return "Add disclaimers";
  }
}

const isDraft = (status: string | null | undefined) =>
  (status ?? "").trim().toLowerCase() === "draft";

export async function listSystemTasks(
  accessiblePlanIds: readonly string[],
  /**
   * Derived rows to leave out — the ones this reader holds a live ASSIGNMENT for.
   *
   * Passed in rather than looked up here, so this stays a pure derivation of PLAN state: a caller
   * with no assignments to consider (the comments picker, which is deciding what to offer) simply
   * omits it and gets the full list.
   */
  suppressed?: ReadonlySet<string>,
): Promise<SystemTask[]> {
  // Drafts are included alongside live plans: a draft with nothing outstanding is "ready to
  // publish", which is the only task that applies to a plan with no issues at all.
  //
  // Scoped by the reader's accessible plan ids rather than `userId`, so a teammate sees the same
  // derived tasks for a shared plan that its owner does.
  const plans = await prisma.client.findMany({
    where: {
      id: { in: [...accessiblePlanIds] },
      status: { in: [...ACTIVE_CLIENT_STATUSES, "Draft"] },
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_PLANS_SCANNED,
    select: PLAN_ATTENTION_SELECT,
  });

  const tasks: SystemTask[] = [];

  for (const plan of plans) {
    const { issues } = evaluatePlanAttention(plan);

    for (const issue of issues) {
      // One row per unit of work. While this reader holds an assignment covering the issue, their
      // assigned row stands in for this one and carries its icon and its destination link, so
      // nothing is lost by leaving the derived row out — the alternative is two rows for one job.
      if (suppressed?.has(derivedTaskKey(plan.id, issue.kind, issue.category ?? null))) {
        continue;
      }
      tasks.push({
        // Keyed by plan and kind (plus category) so the row survives a refetch.
        id: `system-${issue.kind}-${plan.id}-${issue.category ?? ""}`,
        title: systemTaskTitle(issue),
        planName: plan.companyName,
        href: issueDestination(plan.id, issue).href,
        kind: issue.kind,
        // The parts of that id, in the clear — see `SystemTask.clientId`.
        clientId: plan.id,
        category: issue.category ?? null,
      });
    }

    if (
      isDraft(plan.status) &&
      issues.length === 0 &&
      // Never suppressed in practice — publishing cannot be delegated, so no assignment can cover it
      // — but the rule is kept unconditional so it stays true if that ever changes.
      !suppressed?.has(derivedTaskKey(plan.id, "ready-to-publish", null))
    ) {
      tasks.push({
        id: `system-ready-to-publish-${plan.id}`,
        title: "Ready to publish",
        planName: plan.companyName,
        // Publishing runs through the Create Benefit wizard, whose final step is
        // the publish action with its attestation dialog.
        href: `/new-benefits?planId=${encodeURIComponent(plan.id)}`,
        kind: "ready-to-publish",
        clientId: plan.id,
        category: null,
      });
    }
  }

  return tasks;
}

/**
 * The derived rows a reader no longer needs to see, because they hold an assignment covering them.
 *
 * Only assignments that came from a DERIVED task suppress anything — one assigned with a typed title
 * covers no derived row, because there is none it stands in for.
 *
 * Completed assignments still suppress: the row that replaces the derived one is the reader's own,
 * and it stays in the list (ticked) as the record of what they were asked for. Letting the derived
 * row return the moment they tick it off would put two rows back for one job, which is the thing
 * this exists to prevent.
 */
export async function suppressedDerivedRows(userId: string): Promise<Set<string>> {
  const assignments = await prisma.task.findMany({
    where: { userId, derivedKind: { not: null } },
    select: { clientId: true, derivedKind: true, benefitCategory: true },
  });

  return new Set(
    assignments.flatMap((task) =>
      task.clientId && task.derivedKind
        ? [derivedTaskKey(task.clientId, task.derivedKind, task.benefitCategory)]
        : [],
    ),
  );
}

export async function listManualTasks(
  userId: string,
  accessiblePlanIds: readonly string[],
): Promise<ManualTask[]> {
  const tasks = await prisma.task.findMany({
    where: { userId },
    // Open first, then newest, so ticking a task off sinks it without losing it.
    orderBy: [{ done: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      done: true,
      createdAt: true,
      clientId: true,
      // Assignment provenance: all null for a task the reader wrote themselves.
      assignedByUserId: true,
      derivedKind: true,
      benefitCategory: true,
    },
  });

  // Names resolved through a lookup rather than a relation include, so the model stays a
  // single optional id and no join is needed for the common case of an unlinked task.
  const linkedIds = Array.from(
    new Set(tasks.map((task) => task.clientId).filter((id): id is string => Boolean(id))),
  );

  const nameById = new Map<string, string>();
  if (linkedIds.length > 0) {
    // A task may point at a plan the reader reaches through their seat, not only one they own —
    // so resolve names against the accessible set rather than `userId`.
    const accessible = new Set(accessiblePlanIds);
    const visibleLinkedIds = linkedIds.filter((id) => accessible.has(id));
    const plans = visibleLinkedIds.length
      ? await prisma.client.findMany({
          where: { id: { in: visibleLinkedIds } },
          select: { id: true, companyName: true },
        })
      : [];
    for (const plan of plans) nameById.set(plan.id, plan.companyName);
  }

  // Who asked for the work, for the rows that came from a comment. One batched read through the same
  // identity resolver every other byline in the product uses, and nothing at all when the reader has
  // no assigned rows.
  const assignerIds = tasks
    .map((task) => task.assignedByUserId)
    .filter((id): id is string => Boolean(id));
  // Nothing at all for the common case of a reader with no assigned rows — not even the organization
  // lookup that the identity resolver needs.
  const assigners = assignerIds.length
    ? await loadPersonIdentities({
        organizationId: await resolveOrganizationId(userId),
        userIds: assignerIds,
      })
    : new Map();

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    done: task.done,
    createdAt: task.createdAt.toISOString(),
    clientId: task.clientId,
    planName: task.clientId ? (nameById.get(task.clientId) ?? null) : null,
    assignedByUserId: task.assignedByUserId,
    assignedByName: task.assignedByUserId
      ? (assigners.get(task.assignedByUserId)?.name ?? null)
      : null,
    derivedKind: task.derivedKind,
    // Recomputed from the derived identity rather than stored, so the link cannot go stale as the
    // routing changes — and it is the SAME function the derived row itself links through.
    href:
      task.derivedKind && task.clientId
        ? issueDestination(task.clientId, {
            kind: task.derivedKind as PlanAttentionIssueKind,
            category: task.benefitCategory ?? undefined,
          }).href
        : null,
  }));
}
