export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrgSession } from "@/lib/organization-session";
import {
  mapCommentError,
  resolveCommentAccess,
} from "@/lib/comments/comments.server";
import { MAX_ATTACHMENT_BYTES } from "@/lib/comments/types";
import { getPresignedUploadUrl, isR2Configured, putObjectBuffer } from "@/lib/r2";

/**
 * POST /api/clients/[id]/comments/attachments
 *
 * Prepare ONE comment attachment, in one of TWO shapes:
 *
 *  - `application/json` `{ name, type, size, category? }` → `{ uploadUrl, key }`.
 *    The client PUTs the file straight to R2, then sends the descriptor with the comment. The fast
 *    path, and the one the dashboard uses.
 *
 *  - `multipart/form-data` `{ file, category? }` → `{ key }`.
 *    The bytes travel through THIS route and are put to R2 server-side. Why it exists: a direct
 *    browser→R2 PUT is a cross-origin request, so it only succeeds if the bucket's CORS policy names
 *    the origin the page is served from. The Portal Comments UI is addressed at the environment ROOT
 *    (`https://plantel.pro/{slug}`, `https://dev.plantel.pro/{slug}`) while the dashboard may be
 *    reached on a different host — so the same code can be blocked on the portal and fine on the
 *    dashboard, which is a difference nobody should have to diagnose from a spinner that never stops.
 *    Every other upload in this app already solves it this way (`/api/r2/upload-direct`); comments
 *    were the last hand-rolled direct PUT.
 *
 * BOTH shapes authorize with the same `resolveCommentAccess` call — implicit by View, so a
 * Collaborator who may comment may also attach a file — and BOTH mint the key here, under this plan's
 * comment prefix, so the relay cannot land an object anywhere the presigning route would not have.
 * The key scheme is deliberately unchanged: `resolveCommentAttachmentAccess` reads it back, keyed on
 * `comments/`.
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

    const relayed = (request.headers.get("content-type") ?? "").includes(
      "multipart/form-data",
    );

    // Refuse an obviously oversized relay BEFORE buffering it. Multipart framing adds a little
    // overhead, hence the slack — the exact check still happens below, on the real byte length.
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (relayed && declared > MAX_ATTACHMENT_BYTES + 64 * 1024) {
      return NextResponse.json(
        { error: "File is too large (max 15 MB)" },
        { status: 400 },
      );
    }

    let name = "";
    let type = "application/octet-stream";
    let size = 0;
    let category: string | null = null;
    let body: Uint8Array | null = null;

    if (relayed) {
      const form = await request.formData().catch(() => null);
      const file = form?.get("file");
      // Duck-typed rather than `instanceof File`: the check only needs "a blob with a size", and the
      // global is not guaranteed in every runtime this route can be compiled for.
      const isFile =
        !!file &&
        typeof (file as Blob).arrayBuffer === "function" &&
        typeof (file as Blob).size === "number";
      if (!isFile) {
        return NextResponse.json(
          { error: "A file is required" },
          { status: 400 },
        );
      }
      const blob = file as Blob & { name?: string };
      name = String(blob.name ?? "").trim() || "file";
      type = blob.type || "application/octet-stream";
      size = blob.size;
      body = new Uint8Array(await blob.arrayBuffer());
      const rawCategory = form?.get("category");
      category = typeof rawCategory === "string" && rawCategory ? rawCategory : null;
    } else {
      const payload = (await request.json().catch(() => null)) as
        | {
            name?: string;
            type?: string;
            size?: number;
            category?: string | null;
          }
        | null;

      name = String(payload?.name ?? "").trim();
      type = String(payload?.type ?? "").trim() || "application/octet-stream";
      size = typeof payload?.size === "number" ? payload.size : 0;
      category =
        typeof payload?.category === "string" && payload.category
          ? payload.category
          : null;
    }

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
      category,
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

    if (relayed) {
      const stored = await putObjectBuffer({
        key,
        body: body ?? new Uint8Array(),
        contentType: type,
      });
      if (!stored) {
        return NextResponse.json(
          { error: "Could not store the file" },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true, key });
    }

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
