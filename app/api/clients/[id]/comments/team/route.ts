export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { listSurfaceTeam, mapCommentError } from "@/lib/comments/comments.server";
import type { CommentTargetType } from "@/lib/comments/types";

/**
 * GET /api/clients/[id]/comments/team?targetType=&category=
 *
 * Who is on this comments surface — the roster behind the rail's Team button.
 *
 * That is a wider read than `/comments/mentionable` (which feeds @mentions and the assign picker):
 * it merges the access-filtered people list with the plan's ASSIGNMENTS, so a Collaborator whose
 * invitation has not been accepted yet still appears. Those rows are exactly what the benefit's
 * Contacts tab shows, and leaving them out made the roster look empty while the advisor could see a
 * pending collaborator on the plan.
 *
 * Gated on the caller's own VIEW access to the surface, through `resolveCommentAccess` (the same
 * gate every comment read uses) — the roster never reveals a plan the reader cannot open.
 */
function errorResponse(error: unknown) {
  const mapped = mapCommentError(error);
  // A 5xx here is the database being unreachable (the transient `P1001` Neon pooler refuses),
  // not a refusal this feature can explain. Log the real cause for the server and give the
  // dialog a sentence a reader can act on — never the Prisma host/message.
  if (mapped.status >= 500) {
    console.error("[comments/team] could not load the roster", error);
    return NextResponse.json(
      {
        error:
          "The team list couldn't be loaded right now. Please try again.",
      },
      { status: 503 },
    );
  }
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

    const members = await listSurfaceTeam({
      organizationId: session.organizationId,
      userId: session.userId,
      clientIdOrSlug: params.id,
      targetType,
      // Only a benefit surface is narrowed by category; a plan-level rail is the whole plan.
      category:
        targetType === "benefit" ? search.get("category") : null,
    });

    return NextResponse.json({ success: true, members });
  } catch (error) {
    return errorResponse(error);
  }
}
