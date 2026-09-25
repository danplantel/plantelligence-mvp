/**
 * plan-guard.server — the drop-in replacements route files should adopt for T2.
 *
 * Why this exists: before T2, every plan-scoped route rolled its own ownership
 * check — `prisma.client.findFirst({ where: { id, userId } })`, or a local
 * `assertClientOwner` helper. Every one of those hard-codes "the caller is the
 * owner", so a teammate assigned to the plan is refused. Migrating them one at a
 * time is mechanical, but only if there is a single obvious replacement to
 * reach for. These are those replacements.
 *
 * Server-only.
 */

import type { Client } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  loadPlanRow,
  resolvePlanAccessForPlan,
  type PlanAccessInput,
  type PlanAccessGrant,
} from "./access.server";
import type { PermissionFunction } from "@/types/teammate";
import type { RequiredLevel } from "./permission-levels";

export interface PlanGuardInput {
  /** Plan ObjectId or slug. */
  clientIdOrSlug: string;
  userId: string;
  category?: string | null;
  permission?: PermissionFunction;
  level?: RequiredLevel;
}

export type PlanGuardResult =
  | { allowed: true; grant: PlanAccessGrant; clientId: string }
  | { allowed: false; status: number; error: string; code: string };

/**
 * Decision-only guard: use where the route needs to know "may they?" and then
 * works from the plan id.
 *
 * A missing plan is a 404 (so an unassigned plan cannot be probed for
 * existence); every other denial is a 403 carrying the spec's copy.
 */
export async function authorizePlan(
  input: PlanGuardInput,
): Promise<PlanGuardResult> {
  const plan = await loadPlanRow(input.clientIdOrSlug);
  if (!plan) {
    return {
      allowed: false,
      status: 404,
      error: "Client not found",
      code: "plan_not_found",
    };
  }

  const result = await resolvePlanAccessForPlan(plan, input as PlanAccessInput);
  if (result.allowed) {
    return { allowed: true, grant: result, clientId: plan.id };
  }

  return {
    allowed: false,
    status: result.reason === "plan_not_found" ? 404 : 403,
    error: result.message,
    code: result.reason,
  };
}

/**
 * Row-returning guard — the direct replacement for
 * `prisma.client.findFirst({ where: { id: clientId, userId } })`.
 *
 * Returns the full `Client` row when the actor owns the plan **or** holds an
 * assignment for it, and `null` otherwise. Callers that treat `null` as
 * "not found / not allowed" (as the old helpers did) need no other change.
 *
 * One query: the full row is loaded once and authorization is evaluated against
 * it, rather than authorizing and then re-fetching.
 */
export async function getAuthorizedClient({
  clientIdOrSlug,
  userId,
  category,
  permission,
  level,
}: PlanGuardInput): Promise<Client | null> {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(clientIdOrSlug);
  const client = await prisma.client.findFirst({
    where: isObjectId
      ? { OR: [{ id: clientIdOrSlug }, { slug: clientIdOrSlug }] }
      : { slug: clientIdOrSlug },
  });
  if (!client) return null;

  const result = await resolvePlanAccessForPlan(client, {
    userId,
    category,
    permission,
    level,
  });
  return result.allowed ? client : null;
}
