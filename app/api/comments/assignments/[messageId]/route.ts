export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { mapCommentError, withdrawAssignment } from "@/lib/comments/comments.server";

/**
 * DELETE /api/comments/assignments/[messageId] — take an assignment back.
 *
 * Keyed by the MESSAGE rather than by the task, because the message is what the rail has in hand and
 * what the reader clicked. The task behind it is found from that row, so there is no second id for a
 * caller to guess at.
 *
 * Withdrawal does not delete the message: the conversation keeps the record of what was asked for,
 * and the card reads as withdrawn because there is no longer a task to report on. Deleting the task
 * is the part that matters — work nobody is doing should not sit on a dashboard.
 */
function errorResponse(error: unknown) {
  const mapped = mapCommentError(error);
  return NextResponse.json(
    { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
    { status: mapped.status },
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { messageId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await withdrawAssignment({
      organizationId: session.organizationId,
      userId: session.userId,
      messageId: params.messageId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
