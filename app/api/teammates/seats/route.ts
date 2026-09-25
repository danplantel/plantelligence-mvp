export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { resolveOrganizationPermission } from "@/lib/teammates/access.server";
import { expireStaleInvites, getSeatUsage } from "@/lib/teammates/seats.server";

/**
 * GET /api/teammates/seats → the seat meter for the current organization.
 *
 * Spec T3 Part A item 3: "X of Y seats used, with pending invites shown
 * separately. Visible in Settings → Team and on the dashboard."
 *
 * Gated on `org_settings: view`, so a Viewer or Collaborator gets 403 and the
 * UI hides the meter rather than showing a number they shouldn't see.
 */
export async function GET() {
  const session = await getOrgSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await resolveOrganizationPermission({
    userId: session.userId,
    organizationId: session.organizationId,
    permission: "org_settings",
    level: "view",
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "You don't have access to this plan/section" },
      { status: 403 },
    );
  }

  // Release invites past their 14-day hold first, so the meter is truthful.
  await expireStaleInvites(session.organizationId, session.userId);

  return NextResponse.json({ seats: await getSeatUsage(session.organizationId) });
}
