import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  buildUploadKey,
  isR2Configured,
  putObjectBuffer,
} from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Logos/headshots only; keeps request bodies small vs default route limits. */
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * POST multipart/form-data: file, fileName, contentType?, subPath?
 * Stores via server PutObject — same bucket/credentials as GET /api/r2/object.
 * Fallback when browser PUT to presigned URL succeeds but object is not readable.
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
    const subPath = String(formData.get("subPath") || "misc").trim() || "misc";
    const contentType =
      String(formData.get("contentType") || file.type || "application/octet-stream").trim() ||
      "application/octet-stream";

    const buf = Buffer.from(await file.arrayBuffer());
    const key = buildUploadKey({
      orgId: session.user.id,
      subPath,
      fileName,
    });

    const ok = await putObjectBuffer({
      key,
      body: buf,
      contentType,
    });
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
