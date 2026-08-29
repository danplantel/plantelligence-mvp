import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getObjectFromR2, isR2Configured } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/r2/object?key=org/...
 * Streams the object body with same origin so canvas/Fabric can load it without R2 CORS.
 * Auth: session required; key must start with org/{userId}/.
 */
export async function GET(request: NextRequest) {
  try {
    // Public subdomain portals have no session, so the middleware sets
    // x-advisor-id for verified subdomains (same trust model as
    // GET /api/clients?forPortal=1). Without this, R2-keyed portal images
    // (e.g. a Settings background pre-populated into the benefits wizard and
    // rendered by the welcome banner) 401 on the employee portal.
    const portalAdvisorId = request.headers.get("x-advisor-id") || undefined;
    const session = await getServerSession(authOptions);
    const ownerId = portalAdvisorId || session?.user?.id || null;
    if (!ownerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "R2 storage is not configured" },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key")?.trim();
    if (!key) {
      return NextResponse.json(
        { error: "Missing query parameter: key" },
        { status: 400 },
      );
    }

    const expectedPrefix = `org/${ownerId}/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "Access denied to this object" },
        { status: 403 },
      );
    }

    const result = await getObjectFromR2(key);
    if (!result) {
      return NextResponse.json({ error: "Object not found" }, { status: 404 });
    }

    return new Response(result.body as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[R2 object]", error);
    return NextResponse.json(
      { error: "Failed to read object" },
      { status: 500 },
    );
  }
}
