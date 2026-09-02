import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  buildBrandingKey,
  buildDocumentKey,
  buildUploadKey,
  isR2Configured,
  putObjectBuffer,
  toCanonicalCategory,
} from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Same-origin (server-side) uploads only; keeps request bodies reasonable. */
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * POST multipart/form-data: file, fileName, contentType?, purpose?, clientId?, slot?, category?, subPath?
 * Stores via server PutObject — same bucket/credentials as GET /api/r2/object.
 *
 * This is the CORS-safe upload path: the browser talks only to this same-origin
 * route, never directly to the R2 endpoint, so bucket CORS can never block an
 * upload. (Direct presigned PUTs from www.plantel.pro to r2.cloudflarestorage.com
 * were rejected by the bucket CORS policy — no Access-Control-Allow-Origin.)
 *
 * purpose:
 *   - "branding" → requires clientId + slot; builds org/.../plans/{clientId}/branding/{slot}/...
 *   - "document" → requires clientId; builds org/.../plans/{clientId}/documents/...
 *   - default ("upload") → builds org/.../uploads/{subPath}/...
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "R2 storage is not configured" },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const fileName =
      String(formData.get("fileName") || "image.png").trim() || "image.png";
    const contentType =
      String(
        formData.get("contentType") ||
          file.type ||
          "application/octet-stream",
      ).trim() || "application/octet-stream";
    const purpose =
      String(formData.get("purpose") || "upload").trim() || "upload";
    const clientId = String(formData.get("clientId") || "").trim() || undefined;
    const slot = String(formData.get("slot") || "").trim() || undefined;
    const category = String(formData.get("category") || "").trim() || undefined;
    const subPath = String(formData.get("subPath") || "misc").trim() || "misc";

    const orgId = session.user.id;
    let key: string | null = null;

    if (purpose === "branding") {
      if (!clientId || !slot) {
        return NextResponse.json(
          { error: "clientId and slot required for branding upload" },
          { status: 400 },
        );
      }
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId: orgId },
      });
      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 },
        );
      }
      key = buildBrandingKey({ orgId, planId: clientId, slot, fileName });
    } else if (purpose === "document") {
      if (!clientId) {
        return NextResponse.json(
          { error: "clientId required for document upload" },
          { status: 400 },
        );
      }
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId: orgId },
      });
      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 },
        );
      }
      const canonicalCategory = toCanonicalCategory(category ?? undefined);
      key = buildDocumentKey({
        orgId,
        planId: clientId,
        category: canonicalCategory,
        fileName,
      });
    } else {
      key = buildUploadKey({ orgId, subPath, fileName });
    }

    if (!key) {
      return NextResponse.json(
        { error: "Failed to build storage key" },
        { status: 500 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ok = await putObjectBuffer({ key, body: buf, contentType });
    if (!ok) {
      return NextResponse.json(
        { error: "Failed to store object" },
        { status: 500 },
      );
    }

    return NextResponse.json({ key });
  } catch (error) {
    console.error("[R2 upload-direct]", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}
