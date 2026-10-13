export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { listDirectDirectory } from "@/lib/messages/directory.server";
import { mapDirectError } from "@/lib/messages/messages.server";

/**
 * GET /api/messages/directory — who the caller may start a conversation with.
 *
 * Every entry the picker renders comes from here, INCLUDING the ones it must show greyed: a seat
 * with no login yet is returned with `selectable: false` rather than hidden, so the advisor can see
 * why the person cannot be messaged instead of wondering whether the directory is broken.
 *
 * The same function is what the gate consults (`canMessageUser`), so a row this route says is
 * selectable is a row the API will accept — the offer and the refusal cannot disagree.
 */
export async function GET() {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await listDirectDirectory({
      organizationId: session.organizationId,
      viewerUserId: session.userId,
    });

    return NextResponse.json({ success: true, entries });
  } catch (error) {
    const mapped = mapDirectError(error);
    return NextResponse.json(
      { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
      { status: mapped.status },
    );
  }
}
