export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { requireOrganizationPermission } from "@/lib/teammates/access.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import { deleteTeammateProfile } from "@/lib/teammates/profiles.server";
import { getSeatUsage } from "@/lib/teammates/seats.server";
import {
  confirmSelfDeletedProfile,
  getMembershipDetail,
  removePersonFromOrganization,
  removeTeamMemberFromSeat,
  resendTeamMemberInvite,
  setTeamMemberActive,
  updateTeamMember,
} from "@/lib/teammates/team.server";

/**
 * GET /api/teammates/team/[profileId]
 *
 * Spec T6 Part A item 1 — the per-person screen: the profile, its assignments by
 * plan, and the organization's plans for the "Certain Plans" checklist, in one read
 * so the screen cannot render a half-updated view of someone's access.
 *
 * Gated on `org_settings: view` (reading who has access is a management view, not a
 * public one), while every mutation below needs `edit`.
 */
export async function GET(
  _request: NextRequest,
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
      level: "view",
    });

    const detail = await getMembershipDetail({
      organizationId: session.organizationId,
      profileId: params.profileId,
    });

    return NextResponse.json({ success: true, ...detail });
  } catch (error) {
    if (error instanceof TeammateDataError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[teammates/team/[profileId]] GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/teammates/team/[profileId]
 *
 * Six operations, chosen by `action`:
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
 *  - **`action: "resend_invite"`** — re-deliver an invitation that is still open. A
 *    delivery retry rather than a new grant: the link is derived from `invitedAt`, so an
 *    open invitation goes out with the same link and the same remaining window (the email
 *    states the days actually left). A LAPSED hold is re-opened instead, because its link
 *    is already dead — `resendTeamMemberInvite` owns both paths, plus the seat re-check
 *    and the refusals for a deactivated, already-accepted or un-invited person.
 *  - **`action: "delete"`** — spec T6 item 3, the third of the three separate
 *    actions. Only reachable with no assignments left: `deleteTeammateProfile`
 *    owns that guard (409 `profile_has_assignments`), so the client's disabled
 *    button is a courtesy rather than the enforcement.
 *  - **`action: "confirm_self_deletion"`** — the Owner/Admin's side of a member deleting
 *    their OWN login. The profile was flagged `selfDeletedAt` by
 *    `DELETE /api/profile/delete` and its seat deliberately kept; confirming removes the
 *    person and their assignments and releases the seat. `confirmSelfDeletedProfile`
 *    refuses a profile that was not self-deleted, so this is not a second route to
 *    `remove_from_organization`.
 *  - **`action: "remove_from_seat"`** — remove the person and give their seat up. The
 *    profile is deleted (its assignments first), because no state keeps an accepted
 *    member's profile yet stops counting their seat; the seat is released by the row
 *    disappearing. The response reports `releasedSeats`; `removeTeamMemberFromSeat` owns
 *    the reasoning and the reserved-Owner-seat guard.
 *  - **`action: "remove_from_organization"`** — remove the person entirely, which is the
 *    only way to act on T6 item 3's "no remaining assignments" rule from the UI: their
 *    assignments are removed first (spec T6 Part B item 1, audited per assignment) and the
 *    profile is then deleted through the same guarded writer the strict `delete` uses. The
 *    response reports how much access went with them. Without this, a Collaborator on any
 *    plan was unremovable — `delete` refuses with 409 `profile_has_assignments` and nothing
 *    in the Collaborators list can drop an assignment.
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

    if (body.action === "resend_invite") {
      const resent = await resendTeamMemberInvite({
        organizationId: session.organizationId,
        actorUserId: session.userId,
        profileId: params.profileId,
      });

      // `emailSent`/`emailError` are reported rather than thrown: a mail failure leaves the
      // invitation exactly as it was, so it is a delivery problem to show the advisor, not a
      // failed action to retry blindly.
      return NextResponse.json({
        success: true,
        member: {
          profileId: resent.profileId,
          state: resent.state,
          refreshedWindow: resent.refreshedWindow,
          expiresInDays: resent.expiresInDays,
          // The window the server will enforce before another resend is allowed, so the button's
          // countdown is the real lock rather than a second guess at it.
          cooldownSeconds: resent.cooldownSeconds,
        },
        emailSent: resent.emailSent,
        emailError: resent.emailError,
        // A lapsed hold was re-taken, so the meter can move.
        seats: resent.seats,
      });
    }

    if (body.action === "delete") {
      const removed = await deleteTeammateProfile({
        id: params.profileId,
        organizationId: session.organizationId,
        actorUserId: session.userId,
      });

      return NextResponse.json({
        success: true,
        member: { profileId: removed.id, deleted: true },
        seats: await getSeatUsage(session.organizationId),
      });
    }

    if (body.action === "confirm_self_deletion") {
      const confirmed = await confirmSelfDeletedProfile({
        organizationId: session.organizationId,
        actorUserId: session.userId,
        profileId: params.profileId,
      });

      return NextResponse.json({
        success: true,
        member: {
          profileId: confirmed.profileId,
          removedAssignments: confirmed.removedAssignments,
          deleted: true,
        },
        releasedSeats: confirmed.releasedSeats,
        seats: confirmed.seats,
      });
    }

    if (body.action === "remove_from_organization") {
      const removed = await removePersonFromOrganization({
        organizationId: session.organizationId,
        actorUserId: session.userId,
        profileId: params.profileId,
      });

      return NextResponse.json({
        success: true,
        member: {
          profileId: removed.profileId,
          removedAssignments: removed.removedAssignments,
          deleted: true,
        },
        seats: removed.seats,
      });
    }

    if (body.action === "remove_from_seat") {
      const removed = await removeTeamMemberFromSeat({
        organizationId: session.organizationId,
        actorUserId: session.userId,
        profileId: params.profileId,
      });

      return NextResponse.json({
        success: true,
        member: {
          profileId: removed.profileId,
          outcome: removed.outcome,
          state: removed.state,
        },
        releasedSeats: removed.releasedSeats,
        seats: removed.seats,
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
        {
          error: error.message,
          code: error.code,
          // Carried only when the refusal is a WAIT rather than a wall (the resend cooldown), so
          // the client can start the same countdown a successful resend starts.
          ...(error.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: error.retryAfterSeconds }
            : {}),
        },
        { status: error.status },
      );
    }
    console.error("[teammates/team/[profileId]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
