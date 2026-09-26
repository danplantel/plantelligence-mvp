export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { listPlanAssignments } from "@/lib/teammates/invites.server";
import { resolvePlanAccess } from "@/lib/teammates/access.server";

/**
 * GET /api/teammates/plan-assignments?planId=…
 *
 * Who is assigned to one plan, for the Create Benefits category cards' "Assigned
 * to …" line (T4 Part A item 6) and for the invite dialog's "already assigned"
 * state.
 *
 * Gated on the caller's own access to THAT plan rather than on org settings: it is
 * read from a plan screen, so anyone the plan is shared with may see who else is on
 * it. The check reuses `resolvePlanAccess` against `create_benefits`, the section
 * the cards belong to, so a Viewer of the plan can read the list while a
 * collaborator with no access to it cannot.
 */
export async function GET(request: NextRequest) {
  const session = await getOrgSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const planId = request.nextUrl.searchParams.get("planId")?.trim() ?? "";
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  const access = await resolvePlanAccess({
    userId: session.userId,
    clientIdOrSlug: planId,
    permission: "create_benefits",
    level: "view",
  });
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message, code: access.reason },
      { status: access.reason === "plan_not_found" ? 404 : 403 },
    );
  }

  const assignments = await listPlanAssignments({
    organizationId: session.organizationId,
    clientId: planId,
  });

  return NextResponse.json({ assignments });
}
