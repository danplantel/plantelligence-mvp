export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  listMentionableUsers,
  mapCommentError,
} from "@/lib/comments/comments.server";

/**
 * GET /api/clients/[id]/comments/mentionable?targetType=&category=
 *
 * The people who can be @mentioned here: the organization's owner plus its active teammates,
 * RESTRICTED to those who can open this plan — and this category, when the surface is a benefit.
 *
 * The list is organization-wide in *source* but not in *result*, deliberately: a mention notifies,
 * and the notification carries the comment's own text, so offering a colleague who cannot open the
 * plan would put its content in their inbox behind a link that refuses them. The plan and category
 * come from the URL for exactly that reason — the list must not disagree with the thread it feeds.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only a benefit surface carries a category; a plan-level thread is scoped by the plan alone.
    const category =
      request.nextUrl.searchParams.get("targetType") === "benefit"
        ? request.nextUrl.searchParams.get("category")
        : null;

    const users = await listMentionableUsers({
      organizationId: session.organizationId,
      clientIdOrSlug: params.id,
      category,
    });
    return NextResponse.json({ success: true, users });
  } catch (error) {
    const mapped = mapCommentError(error);
    return NextResponse.json(
      { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
      { status: mapped.status },
    );
  }
}
