export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { requireOrganizationPermission } from "@/lib/teammates/access.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import {
  inviteCollaboratorToPlan,
  isInviteSource,
  suggestWhoIsThisContext,
} from "@/lib/teammates/invites.server";
import { isWhoIsThisContext } from "@/types/teammate";

/**
 * T4 — invite a Collaborator from Create Benefits — and T5, which raises the same
 * invite from Create Plan → Key Contacts.
 *
 * The two differ only in scope, so they share this endpoint:
 *  - `category` (one) → the category card that was clicked (T4);
 *  - `categories` (one or more) + no answer → the plan-first invite from Key
 *    Contacts (T5), which defaults to the Contributor preset.
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

    // Which surface raised this invite, for the audit row. Defaulted per branch below
    // rather than defaulted to a constant: an unchecked default would label an Edit
    // Client or Settings invite as coming from the Create Plan wizard.
    const source = isInviteSource(body.source) ? body.source : undefined;

    // T5's Key Contacts flow invites to a set of categories and never asks "Who is
    // this?"; T4 sends exactly one category together with the answer.
    const categories = Array.isArray(body.categories)
      ? body.categories.map((value) => String(value)).filter(Boolean)
      : [];
    const isPlanScope = categories.length > 0;

    if (!isPlanScope && !String(body.category ?? "").trim()) {
      return NextResponse.json(
        { error: "A benefit category is required.", code: "category_required" },
        { status: 400 },
      );
    }

    // An answer that was SENT but is unknown is refused rather than defaulted:
    // silently choosing a role for the advisor is worse than making them pick again.
    // Omitted entirely is fine — that is the T5 flow, which defaults to Contributor.
    if (
      body.whoIsThis !== undefined &&
      body.whoIsThis !== null &&
      !isWhoIsThisContext(body.whoIsThis)
    ) {
      return NextResponse.json(
        { error: "Choose who this person is.", code: "who_is_this_required" },
        { status: 400 },
      );
    }
    const whoIsThis = isWhoIsThisContext(body.whoIsThis)
      ? body.whoIsThis
      : undefined;

    const result = await inviteCollaboratorToPlan({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      clientId: String(body.clientId ?? ""),
      ...(isPlanScope
        ? {
            categories,
            // Key Contacts is the default because it is the plan-scoped caller that
            // predates this field; a caller that knows better says so explicitly.
            source: source ?? ("key_contacts" as const),
            inviteContext: "Collaborator",
          }
        : {
            category: String(body.category ?? ""),
            source: source ?? ("create_benefits" as const),
          }),
      email: String(body.email ?? ""),
      ...(whoIsThis ? { whoIsThis } : {}),
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
