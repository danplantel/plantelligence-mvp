export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  getThreadAssignable,
  mapCommentError,
} from "@/lib/comments/comments.server";

/**
 * GET /api/comments/threads/[threadId]/assignable — what the assign dialog may offer.
 *
 * A READ of the permission question as much as of the data: it returns the people this thread may be
 * handed to and the plan's derived tasks that may be handed over, and it refuses outright for anyone
 * who is not an Owner or Admin. The rail therefore asks before it draws the control, and the same
 * predicate answers the write — so what the dialog offers is exactly what the API accepts.
 *
 * NO duplicate wiring to keep in step: the surface (plan, or one benefit category) comes from the
 * thread row inside the server module, never from the query string. A caller cannot ask for a
 * plan-scoped candidate list while naming a benefit thread.
 *
 * Thin by design, like the other comments routes: it translates HTTP and nothing else.
 */
function errorResponse(error: unknown) {
  const mapped = mapCommentError(error);
  return NextResponse.json(
    { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
    { status: mapped.status },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getThreadAssignable({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: params.threadId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
