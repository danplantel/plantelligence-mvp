export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  mapCommentError,
  markCommentTyping,
} from "@/lib/comments/comments.server";

/**
 * POST /api/comments/threads/[threadId]/typing — "I am typing in this thread".
 *
 * A write that returns nothing, because the writer has no business learning who else is typing from
 * a write; that is the read endpoint's job. Kept separate for the same reason the DM's is: the
 * client sends these repeatedly, so it must be as cheap as a single upsert and nothing more.
 *
 * Authorization is `markCommentTyping`'s, which resolves the thread's own plan and category through
 * the same `resolveCommentAccess` a reply uses — so a ping can only be raised where a reply could be
 * posted, and nobody outside the plan can learn a thread exists by pinging it.
 */
function errorResponse(error: unknown) {
  const mapped = mapCommentError(error);
  return NextResponse.json(
    { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
    { status: mapped.status },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await markCommentTyping({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: params.threadId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
