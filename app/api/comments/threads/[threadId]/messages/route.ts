export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  addCommentMessage,
  mapCommentError,
} from "@/lib/comments/comments.server";

/**
 * POST /api/comments/threads/[threadId]/messages
 *
 * Reply to an existing thread. Returns the whole thread so the rail can replace its
 * optimistic copy with the server's at once.
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
    const thread = await addCommentMessage({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: params.threadId,
      body: String(body?.body ?? ""),
      attachments: body?.attachments,
    });

    return NextResponse.json({ success: true, thread }, { status: 201 });
  } catch (error) {
    const mapped = mapCommentError(error);
    return NextResponse.json(
      { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
      { status: mapped.status },
    );
  }
}
