import { getAuthorizedClient } from "@/lib/teammates/plan-guard.server";
import type { Client } from "@prisma/client";

/**
 * Marketing routes need "may this person work on this plan?" — nothing finer.
 *
 * This used to be a bare `client.findFirst({ where: { id, userId } })`, which
 * hard-codes "the caller is the owner" and therefore refused every teammate
 * assigned to the plan. It now goes through the T2 guard, so the owner and any
 * teammate with an assignment for the plan both pass.
 *
 * The collaborator-specific limits (they may never publish, delete or invite) are
 * enforced on the write paths that perform those actions, and the plan-level
 * check still refuses an unassigned plan outright.
 */
export async function getAuthorizedPlanClient(
  clientId: string,
  userId: string,
): Promise<Client | null> {
  return getAuthorizedClient({ clientIdOrSlug: clientId, userId });
}

/**
 * @deprecated Name predates T2 and is now inaccurate — the caller may be a
 * teammate rather than the owner. Prefer `getAuthorizedPlanClient`. Kept as an
 * alias so existing marketing call sites keep working.
 */
export const getOwnedClient = getAuthorizedPlanClient;
