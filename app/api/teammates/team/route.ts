export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { requireOrganizationPermission } from "@/lib/teammates/access.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import { expireStaleInvites, getSeatUsage } from "@/lib/teammates/seats.server";
import { addTeamMember, listTeamMembers } from "@/lib/teammates/team.server";

/**
 * Team Member management (spec T3).
 *
 * Both verbs are gated on the `org_settings` permission rather than a bespoke
 * rule, which gives the spec's "Owner/Admin only" outcome for free and keeps the
 * collaborators hard-block (they can never hold Org Settings) enforced in one
 * place. A collaborator therefore cannot list or add Team Members.
 */

function errorResponse(error: unknown): NextResponse {
  if (error instanceof TeammateDataError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error("[teammates/team]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** GET → the Settings → Team list plus the seat meter. */
export async function GET() {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireOrganizationPermission({
      userId: session.userId,
      organizationId: session.organizationId,
      permission: "org_settings",
      level: "view",
    });

    // Release invites past their 14-day hold before reporting state, so the list
    // and the meter never show a seat that has already been released.
    await expireStaleInvites(session.organizationId, session.userId);

    const [team, seats] = await Promise.all([
      listTeamMembers(session.organizationId),
      getSeatUsage(session.organizationId),
    ]);

    return NextResponse.json({ team, seats });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST → add a Team Member (or Collaborator) and create their assignments. */
export async function POST(request: NextRequest) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireOrganizationPermission({
      userId: session.userId,
      organizationId: session.organizationId,
      permission: "org_settings",
      level: "edit",
    });

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const result = await addTeamMember({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      name: typeof body.name === "string" ? body.name : null,
      email: String(body.email ?? ""),
      type: body.type as never,
      role: body.role as never,
      planScope: body.planScope as never,
      planIds: Array.isArray(body.planIds)
        ? body.planIds.map((id) => String(id))
        : undefined,
      planId: typeof body.planId === "string" ? body.planId : null,
      categoryScope: body.categoryScope as never,
      categories: Array.isArray(body.categories)
        ? body.categories.map((category) => String(category))
        : undefined,
      // Spec T3 item 3: only set by the UI after the upgrade confirm.
      confirmUpgrade: body.confirmUpgrade === true,
    });

    return NextResponse.json({
      success: true,
      member: {
        profileId: result.profileId,
        personType: result.personType,
        state: result.state,
        assignmentCount: result.assignmentIds.length,
      },
      seats: result.seats,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
