import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getObjectFromR2, isR2Configured } from "@/lib/r2";
import { resolvePortalAdvisorId } from "@/lib/portal-access";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** First path segment of the Referer — the plan slug on the public portal. */
function planSlugFromReferer(request: NextRequest): string | undefined {
  const referer = request.headers.get("referer");
  if (!referer) return undefined;
  try {
    const segment = new URL(referer).pathname.split("/").filter(Boolean)[0];
    return segment ? decodeURIComponent(segment) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * GET /api/r2/object?key=org/...
 * Streams the object body with same origin so canvas/Fabric can load it without R2 CORS.
 *
 * Auth:
 *  - Dashboard: a session is required and the key must start with org/{userId}/.
 *  - Public portal (anonymous): the request is scoped to the plan in the URL —
 *    the `?clientSlug=` query param or the Referer path (/{slug}/…) — so a key is
 *    only readable when it belongs to that plan's owning advisor.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let ownerId: string | undefined = session?.user?.id;

    if (!ownerId) {
      // Anonymous portal image load: scope to the plan slug in the query or the
      // Referer, then verify the requested key belongs to that plan's advisor.
      const planSlug =
        request.nextUrl.searchParams.get("clientSlug")?.trim() ||
        planSlugFromReferer(request);
      if (planSlug) {
        ownerId = await resolvePortalAdvisorId(request, true, planSlug);
      }
    }

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
