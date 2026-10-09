export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  deleteCommentThread,
  mapCommentError,
  setCommentThreadResolved,
} from "@/lib/comments/comments.server";

/**
 * PATCH/DELETE /api/comments/threads/[threadId]
 *
 * PATCH toggles the thread's resolved state; DELETE removes it and its messages.
 * Both are moderated in `comments.server` (thread author, plan owner, or
 * organization Owner/Admin).
 */

function errorResponse(error: unknown) {
  const mapped = mapCommentError(error);
  return NextResponse.json(
    { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
    { status: mapped.status },
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | { resolved?: boolean }
      | null;
    const thread = await setCommentThreadResolved({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: params.threadId,
      resolved: body?.resolved !== false,
    });

    return NextResponse.json({ success: true, thread });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteCommentThread({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: params.threadId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
