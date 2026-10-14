export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { listAssignable, mapCommentError } from "@/lib/comments/comments.server";
import type { CommentTargetType } from "@/lib/comments/types";

/**
 * GET /api/clients/[id]/comments/assignable — what the assign dialog may offer.
 *
 * Keyed by the SURFACE (a plan, or one benefit category) rather than by a thread, because assigning
 * no longer requires one: the panel's Assign button is available with nothing open, and that is the
 * case where the assignment CREATES its thread. So this answers "what may be handed over from this
 * panel", which is the question the button actually asks.
 *
 * A read of the permission question as much as of the data: it returns the people this surface may be
 * handed to, the plan's delegable automated tasks, and the assigner's own tasks on that plan — and it
 * refuses outright for anyone who is not an Owner or Admin. The same predicate answers the write, so
 * what the dialog offers is exactly what the API accepts.
 *
 * The surface arrives as query parameters, exactly as `/comments/mentionable` and `/comments/typing`
 * already take theirs, and `resolveCommentAccess` re-resolves it from scratch: a forged category
 * gains nothing, because the access check and every candidate's own check are made against it.
 */
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

    const search = request.nextUrl.searchParams;
    const targetType: CommentTargetType =
      search.get("targetType") === "benefit" ? "benefit" : "plan";

    const data = await listAssignable({
      organizationId: session.organizationId,
      userId: session.userId,
      clientIdOrSlug: params.id,
      targetType,
      category: search.get("category"),
      // The automated list is the organisation's outstanding work, narrowed by WHO it is for — the
      // dialog re-asks with this the moment a person is picked, so the offer can never include a plan
      // they cannot open.
      assigneeUserId: search.get("assigneeUserId"),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
