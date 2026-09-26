export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { requireOrganizationPermission } from "@/lib/teammates/access.server";
import {
  removeAssignment,
  updateAssignment,
} from "@/lib/teammates/assignments.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import { getSeatUsage } from "@/lib/teammates/seats.server";

/**
 * One assignment, addressed directly (spec T6 Part A items 1 and 4).
 *
 * The T6 screen lists a person's assignments by plan, and each row carries its own
 * controls — a role and a "Show on Benefits Hub" toggle — which is per-assignment,
 * not per-person. The person-level route (`/api/teammates/team/[profileId]`) applies
 * ONE role across every assignment, so it cannot express "Editor on Ayres, Viewer on
 * Precision Optical"; that is what this route is for.
 *
 * Both verbs delegate to the module's own writers rather than editing rows here, so
 * the permission grid is re-finalized, the collaborator hard blocks are re-validated,
 * and the "never remove the last Owner" guard applies. Every change is audited by
 * those writers with the acting user and the time (T6 Part B item 5).
 *
 * Gated on `org_settings: edit` — the same gate as the rest of team management, which
 * is how the module keeps "Owner/Admin only" in one place.
 */

function errorResponse(error: unknown, scope: string): NextResponse {
  if (error instanceof TeammateDataError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error(`[teammates/assignments/[assignmentId]] ${scope}`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** PATCH → the per-assignment controls: role and hub visibility. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { assignmentId: string } },
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

    const assignment = await updateAssignment({
      assignmentId: params.assignmentId,
      organizationId: session.organizationId,
      actorUserId: session.userId,
      // Omitted keys mean "leave it alone" — a role-only edit must not reset the
      // category scope, which is why each is spread conditionally rather than passed
      // through as undefined and then defaulted somewhere downstream.
      ...(body.role !== undefined
        ? { role: String(body.role) as never }
        : {}),
      ...(body.categoryScope !== undefined
        ? { categoryScope: String(body.categoryScope) as never }
        : {}),
      ...(Array.isArray(body.categories)
        ? { categories: body.categories.map((value) => String(value)) }
        : {}),
      ...(body.showOnBenefitsHub !== undefined
        ? { showOnBenefitsHub: body.showOnBenefitsHub === true }
        : {}),
    });

    return NextResponse.json({
      success: true,
      assignment,
      seats: await getSeatUsage(session.organizationId),
    });
  } catch (error) {
    return errorResponse(error, "PATCH");
  }
}

/** DELETE → spec T6 item 1: "access to that plan or category ends immediately". */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { assignmentId: string } },
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

    const removed = await removeAssignment({
      assignmentId: params.assignmentId,
      organizationId: session.organizationId,
      actorUserId: session.userId,
    });

    return NextResponse.json({
      success: true,
      removed,
      seats: await getSeatUsage(session.organizationId),
    });
  } catch (error) {
    return errorResponse(error, "DELETE");
  }
}
