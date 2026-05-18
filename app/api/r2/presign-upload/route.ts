import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  buildDocumentKey,
  buildBrandingKey,
  buildUploadKey,
  getPresignedUploadUrl,
  isR2Configured,
  toCanonicalCategory,
} from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type PresignUploadPurpose = "document" | "branding" | "upload";

/**
 * POST /api/r2/presign-upload
 * Returns a presigned PUT URL for direct client upload to R2.
 * Body: { purpose, clientId, fileName, contentType, category?, type?, slot? }
 * - purpose: "document" | "branding" | "upload"
 * - For document: clientId, fileName, contentType, category (optional), type (optional)
 * - For branding: clientId, fileName, contentType, slot (e.g. logo, background, thumbnail)
 * - For upload: clientId (as orgId), fileName, contentType, subPath (e.g. templates)
 *
 * Response: { uploadUrl, key }. Client PUTs file to uploadUrl, then saves key in DB/metadata.
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
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      purpose,
      clientId,
      fileName,
      contentType,
      category,
      type,
      slot,
      subPath,
    } = body as {
      purpose: PresignUploadPurpose;
      clientId?: string;
      fileName?: string;
      contentType?: string;
      category?: string;
      type?: string;
      slot?: string;
      subPath?: string;
    };

    if (!purpose || !fileName || !contentType) {
      return NextResponse.json(
        { error: "Missing required fields: purpose, fileName, contentType" },
        { status: 400 }
      );
    }

    const orgId = session.user.id;

    if (purpose === "document") {
      if (!clientId) {
        return NextResponse.json(
          { error: "clientId required for document upload" },
          { status: 400 }
        );
      }
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId: orgId },
      });
      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      const canonicalCategory = toCanonicalCategory(category ?? undefined);
      const key = buildDocumentKey({
        orgId,
        planId: clientId,
        category: canonicalCategory,
        fileName,
      });
      const result = await getPresignedUploadUrl({ key, contentType });
      if (!result) {
        return NextResponse.json(
          { error: "Failed to generate upload URL" },
          { status: 500 }
        );
      }
      return NextResponse.json(result);
    }

    if (purpose === "branding") {
      if (!clientId || !slot) {
        return NextResponse.json(
          { error: "clientId and slot required for branding upload" },
          { status: 400 }
        );
      }
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId: orgId },
      });
      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      const key = buildBrandingKey({
        orgId,
        planId: clientId,
        slot,
        fileName,
      });
      const result = await getPresignedUploadUrl({ key, contentType });
      if (!result) {
        return NextResponse.json(
          { error: "Failed to generate upload URL" },
          { status: 500 }
        );
      }
      return NextResponse.json(result);
    }

    if (purpose === "upload") {
      const path = subPath ?? "misc";
      const key = buildUploadKey({
        orgId,
        subPath: path,
        fileName,
      });
      const result = await getPresignedUploadUrl({ key, contentType });
      if (!result) {
        return NextResponse.json(
          { error: "Failed to generate upload URL" },
          { status: 500 }
        );
      }
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Invalid purpose; use document, branding, or upload" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[R2 presign-upload]", message, stack);
    return NextResponse.json(
      {
        error: "Failed to generate presigned URL",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
