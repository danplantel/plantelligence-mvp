export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { getDirectThread, mapDirectError } from "@/lib/messages/messages.server";

/**
 * GET /api/messages/threads/[threadId] — one conversation, newest page first.
 *
 * `?before=<ISO>` walks backwards for the "load earlier" affordance. Reading is a GET and does NOT
 * mark the conversation read: that is a separate, explicit POST to `/read`, so a prefetch or a
 * retry cannot silently consume somebody's unread messages.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const thread = await getDirectThread({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: params.threadId,
      before: request.nextUrl.searchParams.get("before"),
    });

    return NextResponse.json({ success: true, thread });
  } catch (error) {
    const mapped = mapDirectError(error);
    return NextResponse.json(
      { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
      { status: mapped.status },
    );
  }
}
