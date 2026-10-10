export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  createCommentThread,
  listCommentThreads,
  mapCommentError,
} from "@/lib/comments/comments.server";
import type {
  CommentAnchorInput,
  CommentTargetType,
} from "@/lib/comments/types";

/**
 * GET/POST /api/clients/[id]/comments
 *
 * The comment threads for one Plan (`targetType=plan`) or one Benefit category
 * (`targetType=benefit&category=Group Health`). Authorization is implicit by View
 * and lives in `comments.server` (`resolvePlanAccess`), so these handlers only
 * translate HTTP.
 */

function readTargetType(value: unknown): CommentTargetType {
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

    const { clientId, threads } = await listCommentThreads({
      organizationId: session.organizationId,
      userId: session.userId,
      clientIdOrSlug: params.id,
      targetType,
      category,
    });

    return NextResponse.json({ success: true, clientId, threads });
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
      | {
          targetType?: string;
          category?: string | null;
          anchor?: CommentAnchorInput;
          body?: string;
          attachments?: unknown;
        }
      | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const thread = await createCommentThread({
      organizationId: session.organizationId,
      userId: session.userId,
      clientIdOrSlug: params.id,
      targetType: readTargetType(body.targetType),
      category: body.category ?? null,
      anchor: body.anchor as CommentAnchorInput,
      body: String(body.body ?? ""),
      attachments: body.attachments,
    });

    return NextResponse.json({ success: true, thread }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
