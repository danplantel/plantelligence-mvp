export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { mapDirectError, sendDirectMessage } from "@/lib/messages/messages.server";

/**
 * POST /api/messages/threads/[threadId]/messages — send.
 *
 * Returns the created message, which is what the rail's optimistic copy is replaced with. The
 * response is a single message rather than the whole thread (unlike the comment reply) because a
 * conversation is appended to, not re-rendered: the client already holds every earlier message,
 * and resending them would make the poll's payload the cost of every send.
 *
 * The body and the attachments are validated in `messages.server` — including that each attachment
 * key lives under THIS thread's prefix, which is how a file uploaded for one conversation cannot
 * be attached to another.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | { body?: string; attachments?: unknown }
      | null;

    const message = await sendDirectMessage({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: params.threadId,
      body: body?.body,
      attachments: body?.attachments,
    });

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (error) {
    const mapped = mapDirectError(error);
    return NextResponse.json(
      { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
      { status: mapped.status },
    );
  }
}
