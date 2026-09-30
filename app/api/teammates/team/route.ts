export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { requireOrganizationPermission } from "@/lib/teammates/access.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import { expireStaleInvites, getSeatUsage } from "@/lib/teammates/seats.server";
import {
  addTeamMember,
  listCollaborators,
  listTeamMembers,
} from "@/lib/teammates/team.server";
import { listCustomBenefitTitles } from "@/lib/teammates/benefit-categories.server";

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

/**
 * GET → the Settings → Team lists plus the seat meter.
 *
 * Two lists, not one: `team` is the seat-holding side (owner first, then Team
 * Members) and `collaborators` is the free side. They are separate readers in
 * team.server.ts because only one of them synthesizes the owner row, and the
 * client renders them in different places (seat cards vs an accordion).
 */
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

    const [team, collaborators, seats, customCategories] = await Promise.all([
      listTeamMembers(session.organizationId),
      listCollaborators(session.organizationId),
      getSeatUsage(session.organizationId),
      // The organisation's own Custom benefit titles, so the access picker can offer them
      // alongside the four canonical categories. Read here rather than from a second
      // endpoint because this response is already the one the Settings tab fetches, and a
      // picker that renders before its category list arrives is a picker that briefly
      // cannot be used.
      listCustomBenefitTitles(session.organizationId),
    ]);

    return NextResponse.json({ team, collaborators, seats, customCategories });
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
      // The Key Contact fields the profile can actually store. An ABSENT key means "not
      // supplied, leave it alone" and an empty string means "clear it", so these are passed
      // as `undefined` when the client did not send them — which is what keeps the Existing
      // Contact slide from blanking out a contact's details on promotion.
      firstName: typeof body.firstName === "string" ? body.firstName : undefined,
      lastName: typeof body.lastName === "string" ? body.lastName : undefined,
      jobTitle: typeof body.jobTitle === "string" ? body.jobTitle : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      phoneExtension:
        typeof body.phoneExtension === "string" ? body.phoneExtension : undefined,
      headshot: typeof body.headshot === "string" ? body.headshot : undefined,
      companyName:
        typeof body.companyName === "string" ? body.companyName : undefined,
      type: body.type as never,
      role: body.role as never,
      planScope: body.planScope as never,
      planIds: Array.isArray(body.planIds)
        ? body.planIds.map((id) => String(id))
        : undefined,
      planId: typeof body.planId === "string" ? body.planId : null,
      // A promotion names the Contact explicitly, so the picker's choice is the person who
      // is promoted. Absent for a fresh add, where the email is the identity.
      profileId: typeof body.profileId === "string" ? body.profileId : null,
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
        // The state the profile is actually in, which is `active` rather than `invited`
        // when the email already belonged to somebody with an account. The UI says
        // "invitation sent" only when `emailSent` is true, so this and the flag below are
        // what keep the toast honest.
        state: result.state,
        assignmentCount: result.assignmentIds.length,
      },
      emailSent: result.emailSent,
      emailError: result.emailError,
      seats: result.seats,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
