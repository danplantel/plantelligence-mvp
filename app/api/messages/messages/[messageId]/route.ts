export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { mapDirectError, withdrawDirectMessage } from "@/lib/messages/messages.server";

/**
 * DELETE /api/messages/messages/[messageId] — withdraw a message.
 *
 * AUTHOR ONLY, and there is no moderator: a private conversation is not curated by the
 * organization, so an Owner or Admin deleting someone else's message is refused by
 * `withdrawDirectMessage`. That is the opposite of the comment rule and is the point.
 *
 * The message is withdrawn, not destroyed — it keeps its place and renders as a placeholder, so
 * the conversation still reads as a conversation.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { messageId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await withdrawDirectMessage({
      organizationId: session.organizationId,
      userId: session.userId,
      messageId: params.messageId,
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
