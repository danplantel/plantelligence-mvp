export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  listCommentTyping,
  mapCommentError,
  markSurfaceTyping,
} from "@/lib/comments/comments.server";
import type { CommentTargetType } from "@/lib/comments/types";

/**
 * GET/POST /api/clients/[id]/comments/typing — the "currently typing" signal for ONE comments
 * surface.
 *
 * GET  — who is typing, per thread AND in the surface's own composer. The rail's fast poll: one
 *        response covers every thread it is showing, because the rail shows them all at once. It is
 *        deliberately not folded into the thread-list read (scoped, and 10s is far too slow for a
 *        typing indicator).
 * POST — "I am composing a NEW comment on this surface" — the rail's persistent composer. There is
 *        no thread to attribute that to, which is why the signal is scoped to the surface itself
 *        rather than to a thread id; replying to an existing thread posts to
 *        `/api/comments/threads/[threadId]/typing` instead.
 *
 * A GET never returns the caller, so the UI does not filter itself out. Authorization and the
 * surface predicate are the same ones the thread list uses, so a surface the reader cannot see is a
 * surface whose typing they cannot be told about.
 */
function readTargetType(value: unknown): CommentTargetType {
  // Mirrors the sibling thread-list route, so both agree on what an unknown value means.
  return value === "benefit" ? "benefit" : "plan";
}

function errorResponse(error: unknown) {
  const mapped = mapCommentError(error);
  return NextResponse.json(
    { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
    { status: mapped.status },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targetType = readTargetType(
      request.nextUrl.searchParams.get("targetType"),
    );
    const category = request.nextUrl.searchParams.get("category");

    const typing = await listCommentTyping({
      organizationId: session.organizationId,
      userId: session.userId,
      clientIdOrSlug: params.id,
      targetType,
      category,
    });

    return NextResponse.json({ success: true, ...typing });
  } catch (error) {
    return errorResponse(error);
  }
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

    const body = (await request.json().catch(() => null)) as
      | { targetType?: unknown; category?: string | null }
      | null;

    await markSurfaceTyping({
      organizationId: session.organizationId,
      userId: session.userId,
      clientIdOrSlug: params.id,
      targetType: readTargetType(body?.targetType),
      category: body?.category ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
