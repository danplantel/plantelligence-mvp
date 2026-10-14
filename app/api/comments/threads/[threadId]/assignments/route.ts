export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { assignTask, mapCommentError } from "@/lib/comments/comments.server";

/**
 * POST /api/comments/threads/[threadId]/assignments — hand work to somebody from this thread.
 *
 * Body: `{ assigneeUserId, title? , derivedTaskId? }`.
 *
 * `title` and `derivedTaskId` are passed through UNVALIDATED here on purpose — the server module
 * decides, and it decides by looking them up in the list the picker was drawn from. A route that
 * checked the shape of a derived id would be a second, weaker copy of that rule.
 *
 * The response is the whole updated thread, so the rail can render the new card without refetching
 * and without guessing: the task's state comes back with it, resolved like every other card's.
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

    const body = await request.json().catch(() => null);

    const view = await assignTask({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: params.threadId,
      assigneeUserId:
        typeof body?.assigneeUserId === "string" ? body.assigneeUserId : "",
      title: body?.title,
      derivedTaskId: body?.derivedTaskId,
    });

    return NextResponse.json({ success: true, data: view }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
