export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  listMentionableUsers,
  mapCommentError,
} from "@/lib/comments/comments.server";

/**
 * GET /api/clients/[id]/comments/mentionable
 *
 * The people a commenter can @mention: the organization's owner plus its active
 * teammates. The plan id is deliberately unused beyond the session check — the list
 * is organization-wide, so it cannot disagree with the task it feeds.
 */
export async function GET() {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await listMentionableUsers({
      organizationId: session.organizationId,
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
