export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { requireOrganizationPermission } from "@/lib/teammates/access.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import { addPlanAssignment } from "@/lib/teammates/team.server";

/**
 * POST /api/teammates/assignments
 *
 * Create ONE plan assignment for an existing membership. Used by the Manage Access screen's
 * "instant add": ticking a plan under Certain Plans creates the assignment immediately, so its
 * per-plan role and Show on Benefits Hub controls are usable at once instead of only after the
 * access block is saved.
 *
 * Gated on `org_settings: edit` — the same rule the other membership writes use — and the whole
 * write is `upsertAssignment`, so the finalize/hard-block/last-Owner guards all still apply.
 */
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

    const body = (await request.json().catch(() => null)) as
      | { profileId?: string; clientId?: string }
      | null;
    const profileId = body?.profileId?.trim();
    const clientId = body?.clientId?.trim();
    if (!profileId || !clientId) {
      return NextResponse.json(
        { error: "profileId and clientId are required" },
        { status: 400 },
      );
    }

    const assignment = await addPlanAssignment({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      profileId,
      clientId,
    });

    return NextResponse.json({
      success: true,
      assignment: {
        id: assignment.id,
        clientId: assignment.clientId,
        role: assignment.role,
        categoryScope: assignment.categoryScope,
        categories: Array.isArray(assignment.categories)
          ? (assignment.categories as string[])
          : [],
        showOnBenefitsHub: Boolean(assignment.showOnBenefitsHub),
        permissionSet: assignment.permissionSet,
      },
    });
  } catch (error) {
    if (error instanceof TeammateDataError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[teammates/assignments] POST", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
