export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { requireOrganizationPermission } from "@/lib/teammates/access.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import { setTeamMemberActive, updateTeamMember } from "@/lib/teammates/team.server";

/**
 * PATCH /api/teammates/team/[profileId]
 *
 * Two operations, chosen by `action`:
 *
 *  - **no action** — edit: display name, role, plan access and benefits access.
 *    The scope is reconciled against the existing assignments through the same
 *    writers the rest of the module uses, so the permission grid, the
 *    collaborator hard blocks and the "never remove the last Owner" guard all
 *    still apply.
 *  - **`action: "deactivate" | "reactivate"`** — spec T6 state transitions. The
 *    profile is kept either way (deactivating ends access; reactivating restores
 *    it), and a deactivated Team Member's seat is released, which is why the
 *    response carries a fresh meter.
 *
 * Gated on `org_settings: edit` — the same rule that keeps a Collaborator and a
 * Viewer out of team management entirely.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { profileId: string } },
) {
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

    if (body.action === "deactivate" || body.action === "reactivate") {
      const changed = await setTeamMemberActive({
        organizationId: session.organizationId,
        actorUserId: session.userId,
        profileId: params.profileId,
        active: body.action === "reactivate",
      });

      return NextResponse.json({
        success: true,
        member: { profileId: changed.profileId },
        seats: changed.seats,
      });
    }

    const result = await updateTeamMember({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      profileId: params.profileId,
      ...(body.name !== undefined
        ? { name: typeof body.name === "string" ? body.name : null }
        : {}),
      role: body.role as never,
      planScope: body.planScope as never,
      planIds: Array.isArray(body.planIds)
        ? body.planIds.map((id) => String(id))
        : undefined,
      categoryScope: body.categoryScope as never,
      categories: Array.isArray(body.categories)
        ? body.categories.map((category) => String(category))
        : undefined,
    });

    return NextResponse.json({
      success: true,
      member: {
        profileId: result.profileId,
        assignmentCount: result.assignmentIds.length,
        removedAssignments: result.removedAssignmentIds.length,
      },
      seats: result.seats,
    });
  } catch (error) {
    if (error instanceof TeammateDataError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[teammates/team/[profileId]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
