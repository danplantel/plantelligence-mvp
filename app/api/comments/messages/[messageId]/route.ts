export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  deleteCommentMessage,
  mapCommentError,
} from "@/lib/comments/comments.server";

/**
 * DELETE /api/comments/messages/[messageId]
 *
 * Withdraw a message (soft delete — the thread keeps its shape). Allowed for the
 * message author, the plan owner, or an organization Owner/Admin.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { messageId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await deleteCommentMessage({
      organizationId: session.organizationId,
      userId: session.userId,
      messageId: params.messageId,
    });
    return NextResponse.json({ success: true, threadId: result.threadId });
  } catch (error) {
    const mapped = mapCommentError(error);
    return NextResponse.json(
      { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
      { status: mapped.status },
    );
  }
}
