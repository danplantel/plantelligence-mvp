export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { requireOrganizationPermission } from "@/lib/teammates/access.server";
import { searchPromotableContacts } from "@/lib/teammates/contacts.server";

/**
 * GET /api/teammates/contacts/search?q=…
 *
 * The People & Access picker: contacts this organization already knows — mirrored from a
 * plan's Key Contacts — but has never given access to. The point is that an advisor
 * promotes a person the system already holds instead of retyping their name and email.
 *
 * Gated on `org_settings: view`, the same rule the Team list uses, so the picker can only
 * ever show people the caller could already see on that tab.
 *
 * An EMPTY `q` is legal and returns the browse list rather than nothing. That is a product
 * decision, not an oversight: a search box that returns no results until you type is
 * invisible to an advisor who does not already know a contact exists, and the whole reason
 * this picker exists is that they do not know who is in there.
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

    const query = request.nextUrl.searchParams.get("q") ?? "";
    const results = await searchPromotableContacts({
      organizationId: session.organizationId,
      query,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[teammates/contacts/search]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
