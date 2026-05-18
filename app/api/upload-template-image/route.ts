import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { autoCropToSquare } from "@/lib/image-processing";
import { putObjectBuffer, buildUploadKey, isR2Configured } from "@/lib/r2";

/**
 * POST /api/upload-template-image
 * Upload image for template variables. Stores in R2 when configured; no files on app server.
 * Returns URL suitable for img src (signed URL path or legacy /uploads path).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const autoCrop = formData.get("autoCrop") !== "false";
    const cropSize = formData.get("cropSize")
      ? parseInt(formData.get("cropSize") as string)
      : 800;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    if (autoCrop && file.type.startsWith("image/")) {
      try {
        buffer = await autoCropToSquare(buffer, cropSize);
      } catch (error) {
        console.warn("Failed to auto-crop image, using original:", error);
      }
    }

    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_") || "image";
    const filename = `template-${Date.now()}-${originalName}`;
    const contentType = file.type || "image/png";

    if (isR2Configured()) {
      const key = buildUploadKey({
        orgId: session.user.id,
        subPath: "templates",
        fileName: filename,
      });
      const ok = await putObjectBuffer({
        key,
        body: buffer,
        contentType,
      });
      if (ok) {
        const url = `/api/r2/signed-url?key=${encodeURIComponent(key)}&redirect=1`;
        return NextResponse.json({
          success: true,
          url,
          key,
          filename,
        });
      }
    }

    return NextResponse.json(
      { error: "Storage unavailable; R2 must be configured for template uploads" },
      { status: 503 },
    );
  } catch (error: any) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { error: "Failed to upload image", details: error.message },
      { status: 500 },
    );
  }
}

