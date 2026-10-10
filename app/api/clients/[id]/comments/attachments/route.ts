export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrgSession } from "@/lib/organization-session";
import {
  mapCommentError,
  resolveCommentAccess,
} from "@/lib/comments/comments.server";
import { MAX_ATTACHMENT_BYTES } from "@/lib/comments/types";
import { getPresignedUploadUrl, isR2Configured } from "@/lib/r2";

/**
 * POST /api/clients/[id]/comments/attachments
 *
 * Presign a direct-to-R2 upload for ONE comment attachment.
 *
 * Body: `{ name, type, size, category? }` (`category` for a benefit thread).
 * Response: `{ uploadUrl, key }`. The client PUTs the file to `uploadUrl`, then sends
 * `{ key, name, type, size }` alongside the comment.
 *
 * Authorized like the rest of comments — implicit by View — so a Collaborator who may
 * comment may also attach a file. The key is minted server-side under this plan's comment
 * prefix, so the client can never choose where an object lands.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "File storage is not configured" },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | {
          name?: string;
          type?: string;
          size?: number;
          category?: string | null;
        }
      | null;

    const name = String(body?.name ?? "").trim();
    const type = String(body?.type ?? "").trim() || "application/octet-stream";
    const size = typeof body?.size === "number" ? body.size : 0;
    if (!name) {
      return NextResponse.json(
        { error: "A file name is required" },
        { status: 400 },
      );
    }
    if (!(size > 0) || size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: "File is too large (max 15 MB)" },
        { status: 400 },
      );
    }

    const access = await resolveCommentAccess({
      userId: session.userId,
      clientIdOrSlug: params.id,
      category: body?.category ?? null,
    });

    // The plan owner's User id is the org segment, matching every other R2 key in the app
    // — which is what lets /api/r2/object authorize a read of this object later.
    const client = await prisma.client.findUnique({
      where: { id: access.clientId },
      select: { userId: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const safeName =
      name.replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) ||
      "file";
    const key = `org/${client.userId}/plans/${access.clientId}/comments/${Date.now()}-${safeName}`;

    const signed = await getPresignedUploadUrl({ key, contentType: type });
    if (!signed) {
      return NextResponse.json(
        { error: "Could not prepare the upload" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      uploadUrl: signed.uploadUrl,
      key,
    });
  } catch (error) {
    const mapped = mapCommentError(error);
    return NextResponse.json(
      { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
      { status: mapped.status },
    );
  }
}
