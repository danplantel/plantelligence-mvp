export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  listDirectThreads,
  mapDirectError,
  openDirectThread,
} from "@/lib/messages/messages.server";

/**
 * GET /api/messages/threads — the caller's inbox.
 *
 * `{ conversations, unreadTotal }`, ready to render: each row already carries the OTHER
 * participant's display identity and the unread count, so the rail never re-derives either.
 * `unreadTotal` is the header badge's number.
 *
 * POST /api/messages/threads — open the conversation with `{ otherUserId }`, creating it if it
 * does not exist.
 *
 * Authorization lives entirely in `messages.server` — membership, the directory predicate, and the
 * pair's canonical ordering. These handlers translate HTTP and nothing else, which is why there is
 * no branch here that could disagree with the rail about who may talk to whom.
 *
 * POST answers 200 rather than 201 on purpose: an upsert that usually finds an existing
 * conversation is "open", and only incidentally "create".
 */
function errorResponse(error: unknown) {
  const mapped = mapDirectError(error);
  return NextResponse.json(
    { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
    { status: mapped.status },
  );
}

export async function GET() {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inbox = await listDirectThreads({
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return NextResponse.json({ success: true, ...inbox });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | { otherUserId?: string }
      | null;

    const { threadId } = await openDirectThread({
      organizationId: session.organizationId,
      userId: session.userId,
      otherUserId: String(body?.otherUserId ?? "").trim(),
    });

    return NextResponse.json({ success: true, threadId });
  } catch (error) {
    return errorResponse(error);
  }
}
