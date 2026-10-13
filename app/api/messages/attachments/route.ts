export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { getPresignedUploadUrl, isR2Configured } from "@/lib/r2";
import {
  assertDirectThreadAccess,
  mapDirectError,
} from "@/lib/messages/messages.server";
import { MAX_ATTACHMENT_BYTES, directAttachmentPrefix } from "@/lib/messages/types";

/**
 * POST /api/messages/attachments — presign a direct-to-R2 upload for ONE message attachment.
 *
 * Body: `{ threadId, name, type, size }`. Response: `{ uploadUrl, key }`. The client PUTs the file
 * to `uploadUrl` and then sends `{ key, name, type, size }` with the message.
 *
 * PARTICIPATION IS CHECKED HERE, before a key is minted — not when the object is later fetched.
 * A presigned URL is a capability: handing one out for somebody else's conversation would be the
 * leak, whatever the read guard does afterwards.
 *
 * The key is built server-side under this thread's prefix, so the client can never choose where an
 * object lands, and `sendDirectMessage` re-checks that the key it is given starts with that same
 * prefix — so a file uploaded for one conversation cannot be attached to another.
 */
export async function POST(request: NextRequest) {
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
          threadId?: string;
          name?: string;
          type?: string;
          size?: number;
        }
      | null;

    const threadId = String(body?.threadId ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const type = String(body?.type ?? "").trim() || "application/octet-stream";
    const size = typeof body?.size === "number" ? body.size : 0;

    if (!threadId) {
      return NextResponse.json(
        { error: "A conversation is required" },
        { status: 400 },
      );
    }
    if (!name) {
      return NextResponse.json({ error: "A file name is required" }, { status: 400 });
    }
    if (!(size > 0) || size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: "File is too large (max 15 MB)" },
        { status: 400 },
      );
    }

    await assertDirectThreadAccess({
      organizationId: session.organizationId,
      userId: session.userId,
      threadId,
    });

    const safeName =
      name.replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "file";
    const key = `${directAttachmentPrefix(
      session.organizationId,
      threadId,
    )}${Date.now()}-${safeName}`;

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
    const mapped = mapDirectError(error);
    return NextResponse.json(
      { error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) },
      { status: mapped.status },
    );
  }
}
