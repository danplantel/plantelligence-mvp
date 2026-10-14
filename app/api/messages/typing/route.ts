export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  listTypingThreadIds,
  mapDirectError,
} from "@/lib/messages/messages.server";

/**
 * GET /api/messages/typing — the ids of the caller's conversations where the OTHER person is typing.
 *
 * The conversation LIST's fast poll. It answers for every conversation at once rather than one call
 * per row, and it is deliberately not folded into the inbox read: the inbox returns up to fifty
 * conversations with per-thread unread counts, far too much work to repeat every couple of seconds
 * for a one-bit-per-row question.
 *
 * The reader's own side is never consulted, so pinging does not paint your own list. The TTL decides
 * what counts as live, which is the whole reason the list can be correct without a "stopped typing"
 * event. Membership is required, like every other read in this module.
 */
export async function GET() {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const typingThreadIds = await listTypingThreadIds({
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return NextResponse.json({ success: true, typingThreadIds });
  } catch (error) {
    const mapped = mapDirectError(error);
    return NextResponse.json(
      { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
      { status: mapped.status },
    );
  }
}
