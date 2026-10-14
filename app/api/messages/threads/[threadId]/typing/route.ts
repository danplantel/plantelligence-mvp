export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  getDirectTyping,
  mapDirectError,
  markDirectTyping,
} from "@/lib/messages/messages.server";

/**
 * GET/POST /api/messages/threads/[threadId]/typing — the "currently typing" signal.
 *
 * Two verbs for one column, because the two sides are genuinely different operations: POST is a
 * WRITE that returns no state (it records the CALLER's own side), GET is a READ of the PEER's side.
 * Collapsing them into one would mean a writer learning the other person's state from a write,
 * which is exactly the coupling this split avoids.
 *
 * Both go through the same participation gate as reading the conversation — there is no admin
 * override, matching the thread itself — so the signal can be neither pushed into nor read out of a
 * conversation the caller is not in.
 *
 * Kept separate from the thread read, and deliberately cheap: the client pings every couple of
 * seconds while someone types, and re-fetching the whole message page at that cadence to answer a
 * one-bit question would be absurd.
 */
function errorResponse(error: unknown) {
  const mapped = mapDirectError(error);
  return NextResponse.json(
    { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
    { status: mapped.status },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const state = await getDirectTyping({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: params.threadId,
    });

    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    return errorResponse(error);
  }
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

    await markDirectTyping({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId: params.threadId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
