export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { mapDirectError, markDirectThreadRead } from "@/lib/messages/messages.server";

/**
 * POST /api/messages/threads/[threadId]/read — move the reader's watermark.
 *
 * Deliberately its own verb rather than a side effect of the thread GET: the rail marks a
 * conversation read when the reader is actually looking at it, and a prefetch, a retry or a
 * background poll must never be able to clear an unread badge on their behalf. It also clears the
 * conversation's Bell row, so the two signals cannot disagree.
 */
export async function POST(
  _request: Request,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await markDirectThreadRead({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: params.threadId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const mapped = mapDirectError(error);
    return NextResponse.json(
      { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
      { status: mapped.status },
    );
  }
}
