export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { requireOrganizationPermission } from "@/lib/teammates/access.server";
import { searchCollaborators } from "@/lib/teammates/invites.server";

/**
 * GET /api/teammates/collaborators/search?q=…
 *
 * The invite dialog's "Add Existing Collaborator" typeahead (T4 Part A item 5):
 * matches a person's name, email or partner company within the organization.
 *
 * Gated on `org_settings: view` — the same rule the Team Members list uses, so the
 * picker can only show people the caller could already see on that tab. Deactivated
 * collaborators are excluded on purpose; reactivating is a Settings action.
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

    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const results = await searchCollaborators({
      organizationId: session.organizationId,
      query,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[teammates/collaborators/search]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
