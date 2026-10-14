export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { getPersonCard } from "@/lib/teammates/person-card.server";

/**
 * GET /api/teammates/people/[userId] — one colleague, for the profile card.
 *
 * `{ person }`, already projected: the display identity (name and picture from the one resolver every
 * other surface uses), the seat's standing and contact details, and `canMessage` — the directory's own
 * verdict, so the card's Message button cannot offer something `POST /api/messages/threads` would
 * refuse.
 *
 * Answers 404 rather than 403 for someone outside this organization: membership in the organization
 * is the read's whole authorization, and there is nothing here to distinguish "not allowed" from
 * "not a colleague" — saying which would confirm an account the viewer may not know exists. That
 * decision lives in `person-card.server`, not here, so a second caller cannot forget to make it.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { userId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const person = await getPersonCard({
      organizationId: session.organizationId,
      viewerUserId: session.userId,
      userId: params.userId,
    });

    if (!person) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, person });
  } catch (error) {
    console.error("[teammates/people/[userId]] GET", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
