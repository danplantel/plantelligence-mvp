import prisma from "@/lib/prisma";
import { ACTIVE_CLIENT_STATUSES } from "@/lib/active-client-status";
import type { ManualTask, SystemTask } from "@/lib/dashboard-tasks";
import { issueDestination } from "@/lib/plan-attention-actions";
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

export async function listSystemTasks(userId: string): Promise<SystemTask[]> {
  // Drafts are included alongside live plans: a draft with nothing outstanding is "ready to
  // publish", which is the only task that applies to a plan with no issues at all.
  const plans = await prisma.client.findMany({
    where: { userId, status: { in: [...ACTIVE_CLIENT_STATUSES, "Draft"] } },
    orderBy: { updatedAt: "desc" },
    take: MAX_PLANS_SCANNED,
    select: PLAN_ATTENTION_SELECT,
  });

  const tasks: SystemTask[] = [];

  for (const plan of plans) {
    const { issues } = evaluatePlanAttention(plan);

    for (const issue of issues) {
      tasks.push({
        // Keyed by plan and kind (plus category) so the row survives a refetch.
        id: `system-${issue.kind}-${plan.id}-${issue.category ?? ""}`,
        title: systemTaskTitle(issue),
        planName: plan.companyName,
        href: issueDestination(plan.id, issue).href,
        kind: issue.kind,
      });
    }

    if (isDraft(plan.status) && issues.length === 0) {
      tasks.push({
        id: `system-ready-to-publish-${plan.id}`,
        title: "Ready to publish",
        planName: plan.companyName,
        // Publishing runs through the Create Benefit wizard, whose final step is
        // the publish action with its attestation dialog.
        href: `/new-benefits?planId=${encodeURIComponent(plan.id)}`,
        kind: "ready-to-publish",
      });
    }
  }

  return tasks;
}

export async function listManualTasks(userId: string): Promise<ManualTask[]> {
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
    },
  });

  // Names resolved through a lookup rather than a relation include, so the model stays a
  // single optional id and no join is needed for the common case of an unlinked task.
  const linkedIds = Array.from(
    new Set(tasks.map((task) => task.clientId).filter((id): id is string => Boolean(id))),
  );

  const nameById = new Map<string, string>();
  if (linkedIds.length > 0) {
    const plans = await prisma.client.findMany({
      where: { id: { in: linkedIds }, userId },
      select: { id: true, companyName: true },
    });
    for (const plan of plans) nameById.set(plan.id, plan.companyName);
  }

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    done: task.done,
    createdAt: task.createdAt.toISOString(),
    clientId: task.clientId,
    planName: task.clientId ? (nameById.get(task.clientId) ?? null) : null,
  }));
}
