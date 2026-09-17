import prisma from "@/lib/prisma";
import { ACTIVE_CLIENT_STATUS_FILTER } from "@/lib/active-client-status";
import {
  evaluatePlanAttention,
  type PlanAttentionInput,
  type PlanAttentionResult,
} from "@/lib/plan-needs-attention";

/**
 * Prisma-backed access to the plans flagged by `lib/plan-needs-attention.ts`.
 *
 * Both `/api/dashboard/stats` (the count) and `/api/dashboard/needs-attention` (the
 * list) go through here, so the tile's number and the panel it expands into are always
 * produced by the same rule.
 */

/** Exactly the plan fields `evaluatePlanAttention` reads. */
const PLAN_ATTENTION_SELECT = {
  id: true,
  companyName: true,
  companyLogo: true,
  keyContacts: true,
  employeePortalPreview: true,
  categoryPortalVisibility: true,
  disclaimers: true,
  documents: {
    select: {
      type: true,
      category: true,
      storageKey: true,
      archivedAt: true,
    },
  },
} as const;

/**
 * Cap on how many plans are scanned for one evaluation. Completeness is computed in
 * memory per plan, so this bounds the work; it is far above a realistic plan count.
 */
const MAX_PLANS_SCANNED = 250;

export interface PlanNeedingAttention {
  id: string;
  companyName: string;
  companyLogo: string | null;
  details: PlanAttentionResult;
}

/**
 * The user's active plans that need attention, most recently updated first.
 *
 * Only active plans are considered — an unpublished draft is not live, so it cannot be
 * "incomplete" in a way the advisor needs to act on.
 */
export async function listPlansNeedingAttention(
  userId: string,
): Promise<PlanNeedingAttention[]> {
  const plans = await prisma.client.findMany({
    where: {
      userId,
      status: ACTIVE_CLIENT_STATUS_FILTER,
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_PLANS_SCANNED,
    select: PLAN_ATTENTION_SELECT,
  });

  const flagged: PlanNeedingAttention[] = [];

  for (const plan of plans) {
    const details = evaluatePlanAttention(plan as PlanAttentionInput);
    if (!details.needsAttention) continue;

    flagged.push({
      id: plan.id,
      companyName: plan.companyName,
      companyLogo: plan.companyLogo,
      details,
    });
  }

  return flagged;
}

/** Number of active plans that need attention. */
export async function countPlansNeedingAttention(
  userId: string,
): Promise<number> {
  const flagged = await listPlansNeedingAttention(userId);
  return flagged.length;
}
