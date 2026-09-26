export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { requireOrganizationPermission } from "@/lib/teammates/access.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import {
  inviteCollaboratorToCategory,
  suggestWhoIsThisContext,
} from "@/lib/teammates/invites.server";
import { isWhoIsThisContext } from "@/types/teammate";

/**
 * T4 — invite a Collaborator from Create Benefits.
 *
 * Deliberately gated on `org_settings` rather than on the per-plan
 * `invite_team_or_collaborators` row, because the spec settles the question in Open
 * Decisions: "Can Editors invite Collaborators? No: Owner/Admin only." The
 * org-settings row is exactly that set — a Collaborator can never hold it (hard
 * block) and an Editor's grid does not include it — so the rule is enforced in one
 * place, and it is also what keeps this endpoint unreachable from a benefits
 * screen by anyone who could not already manage the team.
 */

function errorResponse(error: unknown): NextResponse {
  if (error instanceof TeammateDataError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error("[teammates/invite-collaborator]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * GET → the "Who is this?" suggestion for the address being typed (Part B item 2).
 *
 * A suggestion endpoint, not a validation one: it answers `null` for an unknown
 * domain, an incomplete address or a plan the organization does not own, so the
 * dialog can call it on every debounce tick without treating failure as an error.
 */
export async function GET(request: NextRequest) {
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

    const clientId = request.nextUrl.searchParams.get("clientId")?.trim() ?? "";
    const email = request.nextUrl.searchParams.get("email")?.trim() ?? "";
    if (!clientId || !email) {
      return NextResponse.json({ suggestion: null });
    }

    const suggestion = await suggestWhoIsThisContext({
      organizationId: session.organizationId,
      clientId,
      email,
    });

    return NextResponse.json({ suggestion });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST → create the profile if needed, scope one assignment, and send the invite. */
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

    // An unknown "Who is this?" is refused rather than defaulted: silently
    // choosing a role for the advisor is worse than making them pick again.
    if (!isWhoIsThisContext(body.whoIsThis)) {
      return NextResponse.json(
        { error: 'Choose who this person is.', code: "who_is_this_required" },
        { status: 400 },
      );
    }

    const result = await inviteCollaboratorToCategory({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      clientId: String(body.clientId ?? ""),
      category: String(body.category ?? ""),
      email: String(body.email ?? ""),
      whoIsThis: body.whoIsThis,
      name: typeof body.name === "string" ? body.name : null,
      note: typeof body.note === "string" ? body.note : null,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
      profileId: typeof body.profileId === "string" ? body.profileId : null,
    });

    return NextResponse.json({ success: true, invite: result });
  } catch (error) {
    return errorResponse(error);
  }
}
