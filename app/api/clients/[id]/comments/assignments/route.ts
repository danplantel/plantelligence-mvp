export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { assignTask, mapCommentError } from "@/lib/comments/comments.server";
import type { CommentTargetType } from "@/lib/comments/types";

/**
 * POST /api/clients/[id]/comments/assignments — hand work to somebody from this panel.
 *
 * Body: `{ assigneeUserId, title? , derivedTaskId? , sourceTaskId?, threadId?, targetType, category }`.
 *
 * Keyed by the SURFACE, matching the dialog that draws it: the Assign button lives on the main panel,
 * so there may be no thread at all. When `threadId` IS present it travels in the body and the server
 * reads the surface from that thread's ROW — these query-shaped values are only the fallback for the
 * case where the assignment is itself what creates the thread.
 *
 * `title`, `derivedTaskId` and `sourceTaskId` are passed through UNVALIDATED on purpose: the server
 * module decides, and it decides by looking them up in the lists the picker was drawn from. A route
 * that checked their shape would be a second, weaker copy of those rules.
 *
 * The response is the whole thread — created or existing — so the rail can show the new card without
 * refetching and without guessing: its task state comes back resolved like every other card's.
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
  { params }: { params: { id: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const targetType: CommentTargetType =
      body?.targetType === "benefit" ? "benefit" : "plan";

    const view = await assignTask({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: typeof body?.threadId === "string" ? body.threadId : null,
      surface: {
        clientIdOrSlug: params.id,
        targetType,
        category: typeof body?.category === "string" ? body.category : null,
      },
      assigneeUserId:
        typeof body?.assigneeUserId === "string" ? body.assigneeUserId : "",
      title: body?.title,
      derivedTaskId: body?.derivedTaskId,
      sourceTaskId: body?.sourceTaskId,
    });

    return NextResponse.json({ success: true, data: view }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
