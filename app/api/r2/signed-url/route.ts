import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getPresignedReadUrl, isR2Configured } from "@/lib/r2";
import { resolveObjectAccess } from "@/lib/teammates/access.server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/r2/signed-url?key=...
 * Returns a temporary signed URL to read an object from R2.
 *
 * Auth: the caller must be logged in AND entitled to the object. Keys are
 * `org/{orgId}/plans/{planId}/{documents|branding|uploads}/…` (see lib/r2.ts), so
 * the plan segment is resolved against the caller's assignment — spec T2 Part B
 * item 3: "Signed URLs for documents and media check the assignment before
 * they're issued." Legacy org-level keys fall back to an ownership check.
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

    // T2 enforcement. The previous check was a bare prefix match on
    // `org/{userId}/`, which an owner passes but which says nothing about a
    // collaborator's assignment, and which cannot distinguish one plan from
    // another inside the same org.
    const access = await resolveObjectAccess({
      userId: session.user.id,
      key,
      level: "view",
    });
    if (!access.allowed) {
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
