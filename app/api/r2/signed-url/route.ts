import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getPresignedReadUrl, isR2Configured } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/r2/signed-url?key=...
 * Returns a temporary signed URL to read an object from R2.
 * Used when the caller already has a valid storage key (e.g. from document.storageKey).
 * Auth: user must be logged in (key structure encodes orgId; further checks can be added per use case).
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const disposition = searchParams.get("disposition"); // inline | attachment
    const contentType = searchParams.get("contentType");
    const redirect = searchParams.get("redirect") === "1" || searchParams.get("redirect") === "true";

    if (!key || key.trim() === "") {
      return NextResponse.json(
        { error: "Missing query parameter: key" },
        { status: 400 }
      );
    }

    // Optional: enforce that key starts with org/{userId}/ so user can only get URLs for their objects
    const expectedPrefix = `org/${session.user.id}/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "Access denied to this object" },
        { status: 403 }
      );
    }

    const url = await getPresignedReadUrl({
      key,
      responseContentDisposition:
        disposition === "attachment" ? "attachment" : undefined,
      responseContentType: contentType ?? undefined,
    });

    if (!url) {
      return NextResponse.json(
        { error: "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    if (redirect) {
      return NextResponse.redirect(url, 302);
    }
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[R2 signed-url]", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }
}
